const express = require ('express');
const cors = require ('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const cookieParser = require ('cookie-parser');


const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
};

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOptions.origin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


const verifyJWT = (req, res, next) => {
  const token = req.cookies._et;
  // console.log(req.query, token)
  if (!token) {
    return res.status(401).json({ message: 'Authorization header missing.' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decodedToken) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token.' });
    }
    // console.log(decodedToken)
    req.data = decodedToken.email; // Assuming the email is stored in the token's payload
    next();
  });
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mmanp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const userCollection = client.db('e-mart').collection('users');
    const categoryCollection = client.db('e-mart').collection('category');
    const productsCollection = client.db('e-mart').collection('products');
    const mensProductCollection = client.db('e-mart').collection('mensProduct');
    const menCategoryCollection = client.db('e-mart').collection('menCategory');
    const womenCategoryCollection = client.db('e-mart').collection('womenCategory');
    const groceryCategoryCollection = client.db('e-mart').collection('groceryCategory');
    const beautyCategoryCollection = client.db('e-mart').collection('beautyCategory');
    const cartCollection = client.db('e-mart').collection('carts');

    // app.post('/jwt', (req, res) => {
    //   const user = req.body;
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    //     expiresIn: '1h'
    //   })

    //   res.send({ token })
    // })

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN_SECRET);
    
      res.cookie("_et", token, { httpOnly: true, secure: true, sameSite: 'none' }); // Sending the token as a cookie (secure and httponly)
      res.send({ token });
    });

    app.delete('/jwt', async(req, res) => {
      try{
      
      const _et = req.cookies._et;
      // console.log(_et)
      
      res.clearCookie("_et");
      // console.log(3)
      res.status(200).send(true)
      }
      catch{
        e=>{
          res.status(500).send({ message: 'Internal server error'})
        }
      }
      
    })

    const verifyAdmin = async(req, res, next) => {
      const decodedEmail = req.data;
      const email = decodedEmail;
      // console.log(email)
      const query = { email: email}
      const user = await userCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: 'forbidden message'});
      }

      next();
    }
    

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    
    app.post('/users', async(req, res) => {
      const user = req.body;
      console.log(user)
      const query = { email: user.email }
      console.log(query)
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.data;
      if(decodedEmail !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const user = req.body;
      // console.log(user)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.get('/products', async(req, res) =>{
        const query = {}
        const cursor = productsCollection.find(query);
        const products = await cursor.toArray();
        res.send(products);
    } )

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const product = await productsCollection.findOne(query);
        if (product) {
          res.send(product);
        } else {
          res.status(404).send({ message: "Product not found." });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error." });
      }
    });
    

    app.get('/categories', async(req, res) =>{
        const query = {}
        const cursor = categoryCollection.find(query);
        const categories = await cursor.toArray();
        res.send(categories);
    } )

    app.get('/mensProduct', async(req, res) =>{
        const query = {}
        const cursor = mensProductCollection.find(query);
        const mensProduct = await cursor.toArray();
        res.send(mensProduct);
    } )

    app.get('/menCategory', async(req, res) =>{
        const query = {}
        const cursor = menCategoryCollection.find(query);
        const menCategory = await cursor.toArray();
        res.send(menCategory);
    } )

    app.get('/womenCategory', async(req, res) =>{
        const query = {}
        const cursor = womenCategoryCollection.find(query);
        const womenCategory = await cursor.toArray();
        res.send(womenCategory);
    } )

    app.get('/groceryCategory', async(req, res) =>{
        const query = {}
        const cursor = groceryCategoryCollection.find(query);
        const groceryCategory = await cursor.toArray();
        res.send(groceryCategory);
    } )

    app.get('/beautyCategory', async(req, res) =>{
        const query = {}
        const cursor = beautyCategoryCollection.find(query);
        const beautyCategory = await cursor.toArray();
        res.send(beautyCategory);
    } )

    // app.get('/carts', async (req, res) => {
    //     const email = req.query.email;
        
    //     if (!email) {
    //       res.send([]);
    //     }
    //     const query = { email: email };
    //     const result = await cartCollection.find(query).toArray();
    //     res.send(result);
    //   });

    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.data;
      // console.log(req.data)
      // console.log(5, decodedEmail)
      if(email !== decodedEmail){
        return res.status(401).send({ error: true, message: 'unauthorized'})
      }
        const query = { email: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
    });
    
      

    app.post('/carts', async (req, res) => {
        const product = req.body;
        const result = await cartCollection.insertOne(product);
        res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
    
  } finally {
    
  }
}
run().catch(err => console.error(err));


app.get('/', (req, res) =>{
    res.send('hello');
});

app.listen(port, () =>{
    console.log(`listening to port ${port}`);
});