"use client";

import { useFormStatus } from "react-dom";

type ActionButtonProps = {
  children: React.ReactNode;
  name: string;
  value: string;
  variant?: "primary" | "secondary";
  confirmMessage?: string;
};

export function ActionButton({ children, name, value, variant = "secondary", confirmMessage }: ActionButtonProps) {
  const { pending } = useFormStatus();
  const className = variant === "primary" ? "btn disabled:opacity-60" : "btn-secondary disabled:opacity-60";

  return (
    <button
      className={className}
      name={name}
      value={value}
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {pending ? "Working..." : children}
    </button>
  );
}
