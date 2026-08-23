import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const generateEmbedding = async (
  text: string,
): Promise<number[] | null> => {
  try {
    // gemini-embedding-2 returns 3072 dimensions — must match the
    // `embedding vector(3072)` column in Postgres.
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
};
