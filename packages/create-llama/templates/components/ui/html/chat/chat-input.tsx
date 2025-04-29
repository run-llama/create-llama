"use client";

import { Message } from "./chat-messages";

export interface ChatInputProps {
  /** The current value of the input */
  input?: string;
  /** An input/textarea-ready onChange handler to control the value of the input */
  handleInputChange?: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  /** Form submission handler to automatically reset input and append a user message  */
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  messages: Message[];
  setInput?: (input: string) => void;
}

export default function ChatInput(props: ChatInputProps) {
  return (
    <>
      <form
        onSubmit={props.handleSubmit}
        className="flex w-full max-w-5xl items-start justify-between gap-4 rounded-xl bg-white p-4 shadow-xl"
      >
        <input
          autoFocus
          name="message"
          placeholder="Type a message"
          className="w-full flex-1 rounded-xl p-4 shadow-inner"
          value={props.input}
          onChange={props.handleInputChange}
        />
        <button
          disabled={props.isLoading}
          type="submit"
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 p-4 text-white shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send message
        </button>
      </form>
    </>
  );
}
