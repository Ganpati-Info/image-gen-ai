import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://esicgrievance.vercel.app",
];

const ALLOWED_IMAGE_HOSTS = ["esic.ganpatinfosolutions.com"];

function getCorsOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  return "";
}

function jsonResponse(request: Request, data: unknown, status = 200) {
  const origin = getCorsOrigin(request);

  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return NextResponse.json(data, {
    status,
    headers,
  });
}

export async function OPTIONS(request: Request) {
  const origin = getCorsOrigin(request);

  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return jsonResponse(
        request,
        {
          error: "GEMINI_API_KEY is not configured.",
        },
        500,
      );
    }

    const body = await request.json();

    const title = String(body?.title ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? "").trim();

    if (!title || !description || !imageUrl) {
      return jsonResponse(
        request,
        {
          error: "Title, description and imageUrl are required.",
        },
        400,
      );
    }

    /*
     * Validate image URL
     */

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return jsonResponse(
        request,
        {
          error: "Invalid image URL.",
        },
        400,
      );
    }

    if (parsedUrl.protocol !== "https:") {
      return jsonResponse(
        request,
        {
          error: "Image URL must use HTTPS.",
        },
        400,
      );
    }

    if (!ALLOWED_IMAGE_HOSTS.includes(parsedUrl.hostname)) {
      return jsonResponse(
        request,
        {
          error: "Image URL is not from an allowed source.",
        },
        403,
      );
    }

    /*
     * Fetch the original evidence image from WordPress
     */

    const imageResponse = await fetch(imageUrl, {
      method: "GET",
      headers: {
        Accept: "image/*",
      },
    });

    if (!imageResponse.ok) {
      return jsonResponse(
        request,
        {
          error: `Unable to fetch source image: ${imageResponse.status}`,
        },
        400,
      );
    }

    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return jsonResponse(
        request,
        {
          error: "The provided URL does not point to an image.",
        },
        400,
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
      return jsonResponse(
        request,
        {
          error: "Image must be 10 MB or smaller.",
        },
        400,
      );
    }

    const base64Image = Buffer.from(imageBuffer).toString("base64");

    /*
     * AI prompt
     */

    const prompt = `
You are an AI visual assistant for a government hospital maintenance system.

Your task is to create a realistic visual reference showing how the uploaded
hospital area should look AFTER the requested repair work.

HOSPITAL REQUEST

Title:
${title}

Description:
${description}

IMPORTANT VISUAL REQUIREMENTS

1. Carefully inspect the uploaded photograph.

2. Preserve the same:
   - room
   - architecture
   - walls
   - floor
   - ceiling
   - doors
   - windows
   - camera position
   - camera perspective
   - composition
   - approximate lighting
   - proportions
   - surrounding objects

3. Identify the damaged components visible in the original photograph.

4. Repair or replace ONLY the damaged components that are relevant to the
   hospital request.

5. Do not redesign the room.

6. Do not change the architecture.

7. Do not add new furniture.

8. Do not add people.

9. Do not add signs, text, logos or labels.

10. Do not change the camera viewpoint.

11. Do not remove unrelated objects.

12. Keep the result photorealistic.

13. Make repaired components look physically installed and structurally
    plausible.

14. Keep the surrounding area consistent with the original photograph.

15. The generated image represents an EXPECTED REPAIRED CONDITION.
    It does not represent proof that the repair has been completed.

SPECIFIC REQUEST

Show the hospital room after the requested repair work has been completed.

Do not make unrelated improvements.

The final result should look like the SAME hospital room photographed again
after the requested repair work has been completed.
`;

    /*
     * Send image + prompt to Gemini
     */

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-lite-image",

          input: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image",
              mime_type: contentType,
              data: base64Image,
            },
          ],

          response_format: {
            type: "image",
          },
        }),
      },
    );

    const responseText = await geminiResponse.text();

    /*
     * Gemini error
     */

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiResponse.status, responseText);

      return jsonResponse(
        request,
        {
          error: `Gemini API error: ${geminiResponse.status}`,
          details: responseText,
        },
        geminiResponse.status,
      );
    }

    const interaction = JSON.parse(responseText);

    let generatedImage: string | null = null;
    let generatedText = "";

    /*
     * Primary image output
     */

    if (interaction.output_image) {
      generatedImage = `data:${
        interaction.output_image.mime_type || "image/png"
      };base64,${interaction.output_image.data}`;
    }

    /*
     * Fallback model output blocks
     */

    if (!generatedImage) {
      for (const step of interaction.steps ?? []) {
        if (step.type !== "model_output") {
          continue;
        }

        for (const block of step.content ?? []) {
          if (block.type === "image") {
            generatedImage = `data:${
              block.mime_type || "image/png"
            };base64,${block.data}`;
          }

          if (block.type === "text") {
            generatedText += block.text || "";
          }
        }
      }
    }

    /*
     * Gemini returned no image
     */

    if (!generatedImage) {
      console.error("Gemini response:", interaction);

      return jsonResponse(
        request,
        {
          error: "Gemini completed the request but did not return an image.",
        },
        502,
      );
    }

    /*
     * Successful response
     */

    return jsonResponse(request, {
      success: true,

      context:
        generatedText || "Gemini generated the repaired-condition reference.",

      generatedImage,

      model: "gemini-3.1-flash-lite-image",
    });
  } catch (error) {
    console.error("Gemini reference generation failed:", error);

    return jsonResponse(
      request,
      {
        error:
          error instanceof Error
            ? error.message
            : "Gemini image generation failed.",
      },
      500,
    );
  }
}
