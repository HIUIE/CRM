export type ApiErrorPayload = {
  error?: string | { code?: string; message?: string };
  message?: string;
};
