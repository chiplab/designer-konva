import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  try {
    const templates = await db.template.findMany({
      where: {
        shop: session.shop, // Ensure shop isolation
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return json({ templates });
  } catch (error) {
    console.error("Error listing templates:", error);
    return json({ error: "Failed to list templates" }, { status: 500 });
  }
}