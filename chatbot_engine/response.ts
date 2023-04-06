// Helper, for returning a Response in a format that Zulip understands.
export async function returnResponse(
  message: any,
  status = 200
): Promise<Response> {
  return new Response(
    JSON.stringify({
      content: message,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: status,
    }
  );
}

// Helper function for returning an error response.
export async function returnError(message: string): Promise<Response> {
  console.error(message);
  return returnResponse(`Error: ${message}`, 200);
}
