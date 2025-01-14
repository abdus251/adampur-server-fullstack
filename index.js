const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); 
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.decoded = decoded;
        next();
      } catch (err) {
        return res.status(401).send({ message: "Invalid or expired token" });
      }
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

    // carts collection
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
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

    app.post('/menu', verifyToken, verifyAdmin, async(req, res) =>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    })
    // users related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
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

    app.get('/menu/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

app.patch('/menu/:id', async(req, res) =>{
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
    }
  };

  // Check if `res.item` exists and has the `display_url` property
  if (item && item.display_url) {
    updatedDoc.$set.image = item.display_url;
  } else {
    console.error("Image URL is missing or `item` is undefined");
  }
  
  // if (res.item && res.item.display_url) {
  //   updatedDoc.$set.image = res.item.display_url;
  // } else {
  //   console.error("Image URL is missing or `res.item` is undefined");
  // }
  
  try {
    // Perform your MongoDB update operation
    const result = await menuCollection.updateOne(filter, updatedDoc);
    console.log('Update result:', result);
  } catch (error) {
    console.error('Error updating document:', error);
  }  

  const result = await menuCollection.updateOne(filter, updatedDoc)
  res.send(result);
})

 // payment intent
 
 app.post('/create-payment-intent', async(req, res) => {
  const { price} = req.body;
  const amount = parseInt(price * 100);
  console.log(amount, 'amount inside the intent')

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card']
  });
  res.send({
    clientSecret: paymentIntent.client_secret
  })
})

app.get('/payments/:email', verifyToken, async (req, res) => {
  const query = { email: req.params.email }
  if (req.params.email !== req.decoded.email){
    return res.status(403).send({ message: 'forbidden access' });
  }
  const result = await paymentCollection.find(query).toArray();
  res.send(result);
})

app.post('/payments', async(req, res) =>{
  const payment = req.body;
  const paymentResult = await paymentCollection.insertOne(payment);

  // carefully delete each item from the cart
  console.log('payment info', payment);
  const query = {_id: {
    $in: payment.cartIds.map(id => new ObjectId(id))
  }};

const deleteResult = await cartCollection.deleteMany(query);

  res.send({paymentResult, deleteResult});
})


// stats or ananlytics
app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res) =>{
  const users = await userCollection.estimatedDocumentCount();
  const menuItems = await menuCollection.estimatedDocumentCount();
  const orders = await paymentCollection.estimatedDocumentCount();

  const result = await paymentCollection.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: '$price'
        }
      }
    }
  ]).toArray();

  const revenue = result.length > 0 ? result[0].totalRevenue: 0;

  res.send({
    users,
    menuItems,
    orders,
    revenue

  })
})

// usging aggregate pipeline

const { ObjectId } = require('mongodb');

app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await paymentCollection.aggregate([
      {
        $unwind: '$menuItemIds', // Break down each menuItemId into individual documents
      },
      {
        $addFields: {
          menuItemObjectId: { $convert: { input: '$menuItemIds', to: 'objectId', onError: null, onNull: null } },
        },
      },
      {
        $lookup: {
          from: 'fee',
          localField: 'menuItemObjectId', // Use the converted ObjectId
          foreignField: '_id',
          as: 'menuItems',
        },
      },
      {
        $unwind: '$menuItems', // Flatten the array returned by $lookup
      },
      {
        $group: {
          _id: '$menuItems.name', // Group by the name of menu items
          email: { $first: '$email' }, // Include the email field
          totalOrders: { $sum: 1 }, // Count the number of orders
          menuItems: { $push: '$menuItems' }, // Collect the matched menu items
          revenue: { $sum: { $toDouble: '$menuItems.price' } }, // Calculate total revenue
          quantity: { $sum: 1 }, // Calculate the quantity of each menu item
        },
      },
      {
        $project: {
          _id: 0, // Include the grouped _id (menu item name)
          totalOrders: 1, // Include totalOrders
          menuItems: 1, // Include menuItems
          revenue: 1, // Include revenue
          quantity: 1, // Include quantity
        },
      },
    ]).toArray();

    res.send(result);
  } catch (error) {
    console.error('Error in /order-stats:', error);
    res.status(500).send({ message: 'Internal server error', error });
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

    app.post("/student", async (req, res) => {
      const newStudent = req.body;
      console.log(newStudent);
      const result = await studentCollection.insertOne(newStudent);
      res.send(result);
    });

    app.get("/student", async (req, res) => {
      try {
        const result = await studentCollection.find({}).toArray(); // Call toArray() on the cursor
        res.send(result);
      } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send({ error: "Failed to fetch students" });
      }
    });

    app.delete("/student/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await studentCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("school is running");
});

app.listen(port, () => {
  console.log(`Adampur school is running on port ${port}`);
});
