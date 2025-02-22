const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const helmet = require("helmet");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://adampur-4a343.web.app",
// ];

app.use(
  cors(
    {
    origin: [ "https://adampur-client-fullstack.vercel.app"],
    methods: ["POST", "GET"],
    credentials: true, 
  }
));

app.use(express.json());
app.use(cookieParser());

// my routes here
app.get("/carts", (req, res) => {
  res.json({ message: "Carts data" });
});



// const uri = "mongodb://localhost:27017"
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u8om2pp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.options("*", cors()); // Allows all OPTIONS requests

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection = client.db("adampurDb").collection("users");
    const menuCollection = client.db("adampurDb").collection("menu");
    const reviewCollection = client.db("adampurDb").collection("reviews");
    const studentCollection = client.db("adampurDb").collection("student");
    const feeCollection = client.db("adampurDb").collection("fee");
    const cartCollection = client.db("adampurDb").collection("carts");
    const paymentCollection = client.db("adampurDb").collection("payments");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;

      if (!user || !user.email) {
        return res.status(400).json({ error: "User data is missing" });
      }

      const token = jwt.sign(
        { email: user.email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1h",
        }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "producton",
      });
      res.send({ token });
    });

    // Middleware setup
    app.use(express.json()); // Required for parsing JSON in request body
    app.use(cors({ credentials: true, origin: "http://localhost:5173" }));
    app.use(cookieParser());
    const verifyToken = (req, res, next) => {
      // console.log('inside veryfy token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // logOut
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookeOption, maxAge: 0 })
        .send({ success: true });
    });

    // carts collection
    app.get("/carts", async (req, res) => {
      try {
        const email = req.query.email;
        console.log("Email received:", email);
    
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }
    
        const query = { email };
        const result = await cartCollection.find(query).toArray();
    
        console.log("Cart items found:", result); // Debugging
    
        res.json(result); // Ensure you're sending an array
      } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ message: "Failed to fetch carts", error });
      }
    });
    
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // fee related api
    app.get("/fee", async (req, res) => {
      const result = await feeCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });
    // users related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      //
      //
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // menu related api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };

      let updatedDoc = {
        $set: {
          name: item.name,
          grade: item.grade,
          age: item.age,
          category: item.category,
          price: item.price,
          description: item.description,
          currency: item.currency,
          isOptional: true,
          paymentMode: item.paymentMode,
          remarks: item.remarks,
        },
      };

      // Check if `res.item` exists and has the `display_url` property
      if (item && item.display_url) {
        updatedDoc.$set.image = item.display_url;
      } else {
        console.error("Image URL is missing or `item` is undefined");
      }

      try {
        // Perform your MongoDB update operation
        const result = await menuCollection.updateOne(filter, updatedDoc);
        console.log("Update result:", result);
      } catch (error) {
        console.error("Error updating document:", error);
      }

      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // carefully delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    // stripe-test
    app.get("/stripe-test", async (req, res) => {
      try {
        const balance = await stripe.balance.retrieve();
        res.json(balance);
      } catch (error) {
        console.error(error);
        res.status(500).send("Stripe error");
      }
    });

    // stats or ananlytics
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue,
      });
    });

    // usging aggregate pipeline

    const { ObjectId } = require("mongodb");

    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await paymentCollection
          .aggregate([
            {
              $unwind: "$menuItemIds", // Break down each menuItemId into individual documents
            },
            {
              $addFields: {
                menuItemObjectId: {
                  $convert: {
                    input: "$menuItemIds",
                    to: "objectId",
                    onError: null,
                    onNull: null,
                  },
                },
              },
            },
            {
              $lookup: {
                from: "fee",
                localField: "menuItemObjectId", // Use the converted ObjectId
                foreignField: "_id",
                as: "menuItems",
              },
            },
            {
              $unwind: "$menuItems", // Flatten the array returned by $lookup
            },
            {
              $group: {
                _id: "$menuItems.name", // Group by the name of menu items
                email: { $first: "$email" }, // Include the email field
                totalOrders: { $sum: 1 }, // Count the number of orders
                menuItems: { $push: "$menuItems" }, // Collect the matched menu items
                revenue: { $sum: { $toDouble: "$menuItems.price" } },
                quantity: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                totalOrders: 1,
                menuItems: 1,
                revenue: 1,
                quantity: 1,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error in /order-stats:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
// student related api
    app.get("/student", async (req, res) => {
      try {
        const result = await studentCollection.find({}).toArray();
        console.log("Fetched students:", result); // Debug log
        res.send(result);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send({ error: "Failed to fetch students" });
      }
    });

    app.post("/student", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const student = req.body;
        const studentResult = await studentCollection.insertOne(student);
        res.status(201).json({ success: true, insertedId: studentResult.insertedId });
      } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error });
      }
    });
    

    app.delete("/student/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await studentCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("school is running");
});

app.listen(port, () => {
  console.log(`Adampur school is running on port ${port}`);
});
