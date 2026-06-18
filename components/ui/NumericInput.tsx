"use client";

import type React from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export function NumericInput(props: Props) {
  return (
    <input
      {...props}
      type="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-lpignore="true"
      data-form-type="other"
    />
  );
}
