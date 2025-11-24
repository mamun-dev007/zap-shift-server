const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

// zap_shift
// 9mLzlaI6Ja5ze1Vi

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6dcy7ej.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("zap_shift_server");
    const percelConnection = db.collection("percels");

    // percel api
    app.get("/percels", async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      const option = { sort: { createdAt: -1 } };
      const cursor = percelConnection.find(query, option);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/percels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await percelConnection.findOne(query);
      res.send(result);
    });

    app.post("/percels", async (req, res) => {
      const percel = req.body;
      //percel create time
      percel.createdAt = new Date();
      const result = await percelConnection.insertOne(percel);
      res.send(result);
    });

    app.delete("/percels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await percelConnection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("zap  is shifting!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
