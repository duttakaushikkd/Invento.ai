import { createClerkClient } from "@clerk/backend";
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import type { AuthFn } from "eve/channels/auth";

function clerkAuth(): AuthFn<Request> {
  return async (request) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!secretKey || !publishableKey) return null;
    try {
      const clerk = createClerkClient({ secretKey, publishableKey });
      const requestState = await clerk.authenticateRequest(request, { publishableKey });
      if (!requestState.isSignedIn) return null;
      const session = requestState.toAuth();
      const userId = session.userId;
      if (!userId) return null;
      return {
        authenticator: "clerk",
        principalId: session.orgId ?? userId,
        principalType: "user",
        attributes: { userId, orgId: session.orgId ?? userId },
      };
    } catch {
      return null;
    }
  };
}

export default eveChannel({
  auth: [clerkAuth(), vercelOidc(), localDev()],
});
