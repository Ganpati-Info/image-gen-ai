import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured. Add it to .env.local.",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();

    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const image = formData.get("image");

    if (!title || !description || !(image instanceof File)) {
      return NextResponse.json(
        {
          error: "Title, description and image are required.",
        },
        { status: 400 },
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "Only image files are supported.",
        },
        { status: 400 },
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "Image must be 10 MB or smaller.",
        },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const base64Image = bytes.toString("base64");

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

For example, if the image shows:
- a damaged door, repair or replace the door
- broken window glass, replace the glass
- damaged window frame, restore the frame
- dirty or damaged surrounding surfaces directly related to the repair,
  restore them appropriately

Do not make unrelated improvements.

The final result should look like the SAME hospital room photographed again
after the requested repair work has been completed.
`;

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
              mime_type: image.type,
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

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiResponse.status, responseText);

      return NextResponse.json(
        {
          error: `Gemini API error: ${geminiResponse.status}`,
          details: responseText,
        },
        { status: geminiResponse.status },
      );
    }

    const interaction = JSON.parse(responseText);

    let generatedImage: string | null = null;
    let generatedText = "";

    // Convenience property
    if (interaction.output_image) {
      generatedImage = `data:${
        interaction.output_image.mime_type || "image/png"
      };base64,${interaction.output_image.data}`;
    }

    // Fallback for model output blocks
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

    if (!generatedImage) {
      console.error("Gemini response:", interaction);

      return NextResponse.json(
        {
          error: "Gemini completed the request but did not return an image.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      context:
        generatedText || "Gemini generated the repaired-condition reference.",

      imagePrompt: prompt,

      generatedImage,

      model: "gemini-3.1-flash-lite-image",
    });
  } catch (error) {
    console.error("Gemini reference generation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gemini image generation failed.",
      },
      { status: 500 },
    );
  }
}
