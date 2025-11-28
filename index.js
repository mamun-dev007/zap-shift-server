const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_GETWAY_SECRECT);

const port = process.env.PORT || 3000;
const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // Random HEX (6 chars)
  const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${date}-${randomHex}`;
}


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
    const paymentConnection = db.collection("payments");

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

    // payment related apis

    const DOMAIN = process.env.DOMAIN_SITE;
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;

      console.log("Payment info received:", paymentInfo);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.parcelName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.senderEmail,
        mode: "payment",
        metadata: {
          percelId: paymentInfo.percelId,
          percelName: paymentInfo.percelName,
        },
        success_url: `${DOMAIN}/dashboardLayout/payment-success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url: `${DOMAIN}/dashboardLayout/payment-cancel`,
      });
      console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.sessionId;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
        const transactionId= session.payment_intent;
        const query = { transactionId: transactionId }

        const paymentExit = await paymentConnection.findOne(query);
        if(paymentExit){
          return res.send({
            message:'alreary exits',
            transactionId,
            trackingId:paymentExit.trackingId,
          })
        }



      const trackingId = generateTrackingId();
      if (session.payment_status === "paid") {
        const id = session.metadata.percelId;
        const query = { _id: new ObjectId(id) };
        const upadate = {
          $set: {
            paymentStatus: "paid",
            trackingId:trackingId,
          },
        };
        const result = await percelConnection.updateOne(query, upadate);
        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          percelId: session.metadata.percelId,
          percelName: session.metadata.percelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: trackingId,
        };
        if (
          session.payment_status === "paid" ||
          session.status === "complete"
        ) {
          const resultPayment = await paymentConnection.insertOne(payment);

          res.send({
            succes: true,
            modifyPercel: result,
            paymentInfo: resultPayment,
            trackingId: trackingId,
            transactionId: session.payment_intent,
          });
        }
      }
      return res.send({ success: false });
    });


app.get('/payments',async (req,res) =>{
  const email = req.query.email;
  const query = {};
  if(email){
    query.customerEmail = email;
  }
  const cursor = paymentConnection.find(query);
  const result = await  cursor.toArray();
  res.send(result);
})












    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("zap  is shifting!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
