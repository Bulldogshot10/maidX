import { DocumentPickerAsset, getDocumentAsync } from "expo-document-picker";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";
import { initLlama, loadLlamaModelInfo, RNLlamaOAICompatibleMessage } from "llama.rn";
import { MessageNode } from "message-nodes";
import { Platform } from "react-native";
import { LanguageModelClient, LanguageModelSettings } from "./types";
import { getLlamaRuntimeProfile } from "./runtime-profile";

async function isGGUF(fileUri: string): Promise<boolean> {
  try {
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 4,
      position: 0,
    });

    const bin = globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, "base64").toString("binary");
    if (bin.length < 4) return false;

    return bin.charCodeAt(0) === 0x47 &&
      bin.charCodeAt(1) === 0x47 &&
      bin.charCodeAt(2) === 0x55 &&
      bin.charCodeAt(3) === 0x46;
  } catch {
    return false;
  }
}

async function cleanupLocalModelFiles(modelFiles: Record<string, string>) {
  const updated = { ...modelFiles };
  const locals = Object.keys(updated).filter((key) => key.endsWith("(local)"));

  for (const localKey of locals) {
    try {
      await FileSystem.deleteAsync(updated[localKey], { idempotent: true });
    } catch (error) {
      console.error("Error deleting old model file:", error);
    }
    delete updated[localKey];
  }

  return updated;
}

function parseMessages(messages: Array<MessageNode>): Array<RNLlamaOAICompatibleMessage> {
  return messages.map((message) => {
    const images: Array<string> | undefined = (message.metadata as any)?.images;

    if (images && images.length > 0) {
      return {
        role: message.role,
        content: [
          { type: "text", text: message.content as string },
          ...images.map((uri) => ({
            type: "image_url" as const,
            image_url: { url: uri },
          })),
        ],
      } as RNLlamaOAICompatibleMessage;
    }

    return message as unknown as RNLlamaOAICompatibleMessage;
  });
}

export interface PickedFile {
  key: string;
  files: Record<string, string>;
}

async function pickFile(): Promise<DocumentPickerAsset | undefined> {
  const file = await getDocumentAsync({ multiple: false });
  return file.assets?.[0];
}

// Imports to a unique name so replacing a local file with the same original
// filename cannot cause cleanup to delete the newly imported file.
async function importLocalFile(asset: DocumentPickerAsset, files: Record<string, string>): Promise<PickedFile> {
  const originalName = asset.name || asset.uri.split("/").pop() || "model.gguf";
  const safeName = originalName.replace(/[\\/]/g, "_").replace(/[^\w.()-]/g, "_");
  const key = originalName.replace(/\.[^/.]+$/, "") + " (local)";
  const path = FileSystem.documentDirectory + Date.now() + "-" + safeName;

  await FileSystem.moveAsync({
    from: asset.uri,
    to: path,
  });

  const updated = await cleanupLocalModelFiles(files);
  return { key, files: { ...updated, [key]: path } };
}

export async function pickModelFile(modelFiles: Record<string, string>): Promise<PickedFile | undefined> {
  const asset = await pickFile();
  if (!asset) return;

  // Some Android document providers return content:// URIs without the
  // original extension. Validate the picked display name, then check GGUF magic.
  const fileName = asset.name || asset.uri.split("/").pop() || "";
  if (!/\.gguf$/i.test(fileName) || !(await isGGUF(asset.uri))) {
    alert("Please select a valid GGUF model file");
    return;
  }

  return importLocalFile(asset, modelFiles);
}

export async function pickProjectorFile(projectorFiles: Record<string, string>): Promise<PickedFile | undefined> {
  const asset = await pickFile();
  if (!asset) return;

  const fileName = asset.name || asset.uri.split("/").pop() || "";
  if (!/\.mmproj$/i.test(fileName) && !/\.gguf$/i.test(fileName)) {
    alert("Please select a multimodal projector file");
    return;
  }

  return importLocalFile(asset, projectorFiles);
}

/** Loads the selected GGUF model (and projector, if any) with mobile-safe limits. */
export async function connectLlama(
  { modelKey, modelFiles, projectorKey, projectorFiles, parameters }: LanguageModelSettings
): Promise<LanguageModelClient | undefined> {
  if (!modelKey || !modelFiles[modelKey]) return;

  const modelFile = modelFiles[modelKey];
  if (!(await isGGUF(modelFile))) {
    throw new Error("The selected local model is missing, unreadable, or is not a valid GGUF file.");
  }

  const profile = getLlamaRuntimeProfile({
    platform: Platform.OS,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    totalMemory: Device.totalMemory,
  });

  let info: Record<string, any>;
  try {
    info = await loadLlamaModelInfo(modelFile) as Record<string, any>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error("Could not read GGUF metadata. The file may be incomplete or unsupported. " + detail);
  }

  const ctxKey = Object.keys(info).find((key) => key.toLowerCase().endsWith("context_length"));
  const rawModelContext = ctxKey ? Number(info[ctxKey]) : undefined;
  const modelContext = rawModelContext !== undefined && Number.isFinite(rawModelContext) && rawModelContext > 0
    ? Math.floor(rawModelContext)
    : undefined;
  const savedContext = Number(parameters?.n_ctx);
  const requestedContext = Number.isFinite(savedContext) && savedContext > 0
    ? Math.floor(savedContext)
    : (modelContext ?? Math.min(2048, profile.maxContext));

  // The model's training context is not a safe device allocation target. Clamp
  // both saved preferences and model metadata to the device profile.
  const contextCeiling = Math.min(profile.maxContext, modelContext ?? profile.maxContext);
  const n_ctx = Math.max(512, Math.min(requestedContext, contextCeiling));

  const savedThreads = Number(parameters?.n_threads);
  const n_threads = Number.isFinite(savedThreads) && savedThreads > 0
    ? Math.max(1, Math.min(Math.floor(savedThreads), profile.nThreads))
    : profile.nThreads;

  const savedBatch = Number(parameters?.n_batch);
  const n_batch = Number.isFinite(savedBatch) && savedBatch > 0
    ? Math.max(32, Math.min(Math.floor(savedBatch), profile.nBatch))
    : profile.nBatch;

  const savedUbatch = Number(parameters?.n_ubatch);
  const n_ubatch = Number.isFinite(savedUbatch) && savedUbatch > 0
    ? Math.max(32, Math.min(Math.floor(savedUbatch), profile.nUbatch, n_batch))
    : Math.min(profile.nUbatch, n_batch);

  const projectorFile =
    projectorKey &&
    (projectorKey === modelKey || modelKey.endsWith("(local)"))
      ? projectorFiles[projectorKey]
      : undefined;

  const llama = await initLlama({
    ...parameters,
    model: modelFile,
    use_mlock: profile.useMlock,
    use_mmap: profile.useMmap,
    n_ctx,
    n_threads,
    n_batch,
    n_ubatch,
    n_parallel: profile.nParallel,
    n_gpu_layers: profile.nGpuLayers,
    no_extra_bufts: profile.noExtraBufts,
    ctx_shift: !projectorFile,
  });

  let imagesSupported = false;

  if (projectorFile) {
    try {
      await llama.initMultimodal({
        path: projectorFile,
        // Xclipse acceleration is not verified by llama.rn's documented Android
        // support matrix; use CPU for this device until a real-device test passes.
        use_gpu: !profile.forceCpuBackend,
      });

      const support = await llama.getMultimodalSupport();
      imagesSupported = support.vision;
    } catch (error) {
      await llama.release();
      throw error;
    }
  }

  return {
    imagesSupported,
    prompt: async ({ messages, onUpdate }) => {
      const result = await llama.completion({
        messages: parseMessages(messages),
      }, (data) => onUpdate(data.token));

      console.log("Timings:", result.timings);
    },
    stop: () => llama.stopCompletion(),
    release: () => llama.release(),
  };
}
