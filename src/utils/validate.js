export function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join(", ");

    const error = new Error(message);
    error.status = 400;
    throw error;
  }

  return result.data;
}
