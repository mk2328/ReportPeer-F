import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env.local");
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

function connectToMongo() {
  client = new MongoClient(uri, options);
  return client.connect().catch((error) => {
    if (process.env.NODE_ENV === "development") {
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };
      delete globalWithMongo._mongoClientPromise;
    }
    throw error;
  });
}

if (process.env.NODE_ENV === "development") {
  // Avoid creating a new client on every hot reload, but do not cache a failed connect.
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
    _mongoClientUri?: string;
  };

  if (!globalWithMongo._mongoClientPromise || globalWithMongo._mongoClientUri !== uri) {
    globalWithMongo._mongoClientUri = uri;
    globalWithMongo._mongoClientPromise = connectToMongo();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  clientPromise = connectToMongo();
}

export default clientPromise;