import PromptInputGroup from "@/components/groups/prompt-input-group";
import MessageView from "@/components/views/message/message-view";
import { useChat, useLLM, useSystem } from "@/context";
import { getConversation, hasNode, MessageNode } from "message-nodes";
import { useEffect, useMemo, useRef } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function Chat() {
  const { colorScheme } = useSystem();
  const { mappings, root } = useChat();
  const LLM = useLLM();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MessageNode> | null>(null);
  const isNearBottomRef = useRef(true);
  const wasBusyRef = useRef(false);

  const hasConversation = !!root && hasNode(mappings, root);
  const messages = useMemo(
    () => hasConversation && root ? getConversation(mappings, root).slice(1) : [],
    [hasConversation, mappings, root],
  );

  const renderItem = ({ item }: { item: MessageNode }) => (
    <MessageView
      key={item.id}
      message={item}
    />
  );

  useEffect(() => {
    if (root && !hasConversation) {
      console.warn("No conversation found for id " + root);
    }
  }, [hasConversation, root]);

  // Scroll once when a generation starts, then keep following the stream only
  // while the reader remains near the bottom. This keeps new tokens visible
  // above the keyboard without dragging someone away from older messages.
  useEffect(() => {
    if (LLM.busy && !wasBusyRef.current) {
      isNearBottomRef.current = true;
    }
    wasBusyRef.current = LLM.busy;
  }, [LLM.busy]);

  useEffect(() => {
    if (!isNearBottomRef.current) return;

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, LLM.busy]);

  const styles = StyleSheet.create({
    view: {
      flex: 1,
      flexDirection: "column",
      backgroundColor: colorScheme.surface,
      padding: 8,
    },
    list: {
      flex: 1,
      width: "100%",
    },
    composer: {
      paddingBottom: insets.bottom,
    },
  });

  return (
    // The composer already sits above the screen edge, so the keyboard only
    // needs to make up the difference. Keep the bottom inset below the composer.
    <KeyboardAvoidingView
      testID="chat-page"
      behavior="padding"
      automaticOffset
      keyboardVerticalOffset={-insets.bottom}
      style={styles.view}
    >
      <FlatList
        ref={listRef}
        data={messages}
        style={styles.list}
        keyExtractor={(item, index) => item.id?.toString() ?? "message-" + index}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
          isNearBottomRef.current = distanceFromBottom <= 120;
        }}
      />
      <View style={styles.composer}>
        <PromptInputGroup />
      </View>
    </KeyboardAvoidingView>
  );
}

export default Chat;
