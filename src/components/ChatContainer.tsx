"use client";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ChatPublisher from "@/components/ChatPublisher";
import ChatMessage from "@/components/ChatMessage";
import type { Message } from "@/types/globals";
import { sendStreamingMessage } from "@/utils/sse";

type Props = {
  welcomeMessage: string;
};

type TextChunk = {
  chunk: string;
  offset: number;
};

export default function ChatContainer({ welcomeMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputChunks, setInputChunks] = useState<TextChunk[]>([]);
  const [aiStatus, setAiStatus] = useState<string>("");
  const [isAiTyping, setAiTyping] = useState<boolean>(false);
  const searchParams = useSearchParams();
  const userMessage = searchParams.get("message");

  const aiInput: string = useMemo(() => {
    if (inputChunks && inputChunks.length > 0) {
      return inputChunks
        .sort((a: TextChunk, b: TextChunk) => {
          if (a.offset > b.offset) return 1;
          return -1;
        })
        .map(({ chunk }) => chunk)
        .join("");
    }
    return "";
  }, [inputChunks]);

  useEffect(() => {
    setMessages([]);
    setInputChunks([]);
    addMessage("ai", welcomeMessage);
    if (userMessage) postedMessage(userMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeMessage, userMessage]);

  useEffect(() => {
    setAiStatus("");
  }, [aiInput]);

  useEffect(() => {
    setInputChunks([]);
  }, [isAiTyping]);

  const toShowMessages: Message[] = useMemo(() => {
    if (isAiTyping) {
      return [
        ...messages,
        {
          type: "ai",
          message: aiInput,
          aiStatus: aiStatus,
          isTyping: isAiTyping,
        },
      ];
    } else {
      return messages;
    }
  }, [messages, isAiTyping, aiInput, aiStatus]);

  const addMessage = (type: "ai" | "user", message: string) => {
    setMessages((prev) => [
      ...prev,
      {
        type,
        message,
      },
    ]);
  };
  const addChunk = (chunk: string, offset: number) => {
    setInputChunks((prev) => [
      ...prev,
      {
        chunk,
        offset,
      },
    ]);
  };

  const onSSEProgressIndicator = (message: string) => {
    setAiStatus(message);
  };
  const onSSETextChunk = (chunk: string, offset: number) => {
    addChunk(chunk, offset);
  };
  const onSSEInform = (message: string) => {
    setAiTyping(false);
    addMessage("ai", message);
  };
  const onSSEEndOfTurn = () => {
    setAiTyping(false);
  };

  const handlePostMessage = async (userMessage: string, sequenceId: number) => {
    setAiTyping(true);
    await sendStreamingMessage({
      userMessage,
      sequenceId,
      onSSEProgressIndicator,
      onSSETextChunk,
      onSSEInform,
      onSSEEndOfTurn,
    });
  };

  const postedMessage = async (message: string) => {
    addMessage("user", message);
    handlePostMessage(message, messages.length);
  };

  return (
    <>
      <div className="flex-1 overflow-scroll w-full justify-items-center">
        <div className="flex flex-col gap-4 px-2 w-full md:w-4/5 lg:w-3/5 xl:w-5/8">
          {toShowMessages.map(function (
            { type, message, isTyping, aiStatus },
            idx
          ) {
            return (
              <ChatMessage
                key={idx}
                type={type}
                message={message}
                aiStatus={aiStatus}
                isTyping={isTyping}
              ></ChatMessage>
            );
          })}
        </div>
      </div>
      <div className="flex px-3 pb-12 w-full md:w-4/5 lg:w-3/5 xl:w-5/8">
        <ChatPublisher onPostMessage={postedMessage} />
      </div>
    </>
  );
}
