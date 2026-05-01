"use client";

import { useFormStatus } from "react-dom";

type ActionButtonProps = {
  children: React.ReactNode;
  name: string;
  value: string;
  variant?: "primary" | "secondary";
};

export function ActionButton({ children, name, value, variant = "secondary" }: ActionButtonProps) {
  const { pending } = useFormStatus();
  const className = variant === "primary" ? "btn disabled:opacity-60" : "btn-secondary disabled:opacity-60";

  return (
    <button className={className} name={name} value={value} disabled={pending}>
      {pending ? "Working..." : children}
    </button>
  );
}
