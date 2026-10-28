"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { FormState } from "@/lib/form-state";

type Action<T> = (prev: FormState<T>, formData: FormData) => Promise<FormState<T>>;

/**
 * useActionState for forms that keep their input after submit.
 * React 19 resets uncontrolled fields when a `<form action>` completes, which would wipe the user's
 * input on validation errors — submitting through onSubmit avoids that.
 *
 * `onSuccess` runs as soon as the action returns ok — before the page re-renders — so it still fires
 * when the form itself disappears afterwards (e.g. a status button that no longer applies).
 */
export function useFormAction<T>(action: Action<T>, onSuccess?: (state: FormState<T>) => void) {
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  const [state, dispatch, pending] = useActionState<FormState<T>, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.ok) onSuccessRef.current?.(result);
    return result;
  }, {});

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, onSubmit, pending };
}
