import 'dotenv/config';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { PineconeStore } from "@langchain/pinecone";
import {Pinecone as PineconeClient} from "@pinecone-database/pinecone";

const embeddings = new HuggingFaceInferenceEmbeddings({
  model: "BAAI/bge-base-en-v1.5", // or any HF embedding model
  apiKey: process.env.HUGGINGFACEHUB_API_KEY,
});

const pinecone = new PineconeClient();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

export const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
 pineconeIndex,
 maxConcurrency:5
});

export async function indexTheDoucments(filePath) {
  const loader = new PDFLoader(filePath);
  const doc = await loader.load();


  const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});
const texts = await textSplitter.splitText(doc[0].pageContent);

const documents = texts.map((chunk) => ({ pageContent: chunk, metadata: doc[0].metadata }));

await vectorStore.addDocuments(documents);
}

