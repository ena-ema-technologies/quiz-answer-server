require("dotenv").config()
const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const nodemailer = require('nodemailer');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.luubiof.mongodb.net/?retryWrites=true&w=majority`;

app.use(cors());
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized Access" })
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "Unauthorized Access" })
    }
    req.decoded = decoded;
    next()
  })
}




// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.APP_SERVICE,
    pass: process.env.APP_KEY,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)



    const resultCollection = client.db("personalityTest").collection("allQuizResult");
    const usersCollection = client.db("personalityTest").collection("adminUsers");
    const increaseNumberCOllection = client.db("personalityTest").collection("increaseNumberCOllection")



    // JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "4h" })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      if (result?.role !== "admin") {
        // return res.status(403).send({ error: true, message: "Forbidden access" })
        const result = { admin: false }
        return res.send(result);
      }
      next()
    }



    app.patch("/number-increase", async (req, res) => {

      const increaseNumber = req.query.increaseNumber;
      console.log(increaseNumber)
      const query = {increaseNumber: increaseNumber}
      const result = await increaseNumberCOllection.insertOne(query)
      res.send(result)

    })

    app.get("/number-increase", (req, res) => {
      const result = increaseNumberCOllection.find().toArray()
      res.send(result)
    })



    app.post("/user-test-result", async (req, res) => {
      try {
        const data = req.body;
        const result = await resultCollection.insertOne(data);

        const tableRows = data.allAnswer.map(
          (answer, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f2f2f2'};">
              <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${answer.Name}</td>
              <td style="border: 1px solid #dddddd; text-align: center; padding: 8px;">${answer.Score}</td>
            </tr>
          `
        );

        const emailHTML = `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #88619A; color: #ffffff; text-align: center;">
                <th style="border: 1px solid #dddddd; padding: 8px;">Name</th>
                <th style="border: 1px solid #dddddd; padding: 8px;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows.join('')}
            </tbody>
          </table>
        `;

        const mailOptions = {
          from: process.env.APP_SERVICE,
          to: data.email,
          subject: 'Your Personality Test Result',
          html: emailHTML,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
          } else {
            console.log('Email sent: ' + info.response);
            res.status(200).send(result);
          }
        });
      } catch (error) {
        console.error('Error processing user test result:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    app.post("/send-user-result", async (req, res) => {
      try {
        const data = req.body;

        const tableRows = data.allAnswer.map(
          (answer, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f2f2f2'};">
              <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${answer.Name}</td>
              <td style="border: 1px solid #dddddd; text-align: center; padding: 8px;">${answer.Score}</td>
            </tr>
          `
        );

        const emailHTML = `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #88619A; color: #ffffff; text-align: center;">
                <th style="border: 1px solid #dddddd; padding: 8px;">Name</th>
                <th style="border: 1px solid #dddddd; padding: 8px;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows.join('')}
            </tbody>
          </table>
        `;

        const mailOptions = {
          from: process.env.APP_SERVICE,
          to: "eatscorequiz@gmail.com",
          subject: 'Personality Test Result!',
          html: emailHTML,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
          } else {
            // console.log('Email sent: ' + info.response);
            res.status(200).send(info.response);
          }
        });
      } catch (error) {
        console.error('Error processing user test result:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      // console.log(newUser);
      const email = { email: newUser.email };
      const existUser = await usersCollection.findOne(email);
      if (existUser) {
        return res.json("User Exist!")
      } else {
        const result = await usersCollection.insertOne(newUser);
        return res.send(result);
      }
    })

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" }
      res.send(result);
    })

    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const userUpdate = {
        $set: {
          role: "admin"
        }
      };
      const result = await usersCollection.updateOne(filter, userUpdate);
      res.send(result);
    })

    app.get("/user", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      if (query) {
        const result = await usersCollection.findOne(query);
        res.send(result)
      }
    })

    app.get("/all-test-result", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await resultCollection.find({}).toArray();
      res.send(result)
    })


    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res) => {
  res.send("Personality test Server is running");
})





app.listen(port, () => {
  console.log(`This app listening at port ${port}`);
})