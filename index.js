const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
};

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", corsOptions.origin);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyJWT = (req, res, next) => {
  const token = req.cookies._et;
  // console.log(req.query, token)
  if (!token) {
    return res.status(401).json({ message: "Authorization header missing." });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decodedToken) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token." });
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
  },
});

async function run() {
  try {
    const userCollection = client.db("e-mart").collection("users");
    const profileCollection = client.db("e-mart").collection("profile");
    const addressCollection = client.db("e-mart").collection("addresses");
    const deliveryChargeCollection = client.db("e-mart").collection("deliveryCharge");
    const couponsCollection = client.db("e-mart").collection("coupons");
    const categoryCollection = client.db("e-mart").collection("category");
    const subCategoryCollection = client.db("e-mart").collection("subCategory");
    const productsCollection = client.db("e-mart").collection("products");
    const menCategoryCollection = client.db("e-mart").collection("menCategory");
    const womenCategoryCollection = client
      .db("e-mart")
      .collection("womenCategory");
    const groceryCategoryCollection = client
      .db("e-mart")
      .collection("groceryCategory");
    const beautyCategoryCollection = client
      .db("e-mart")
      .collection("beautyCategory");
    const cartCollection = client.db("e-mart").collection("carts");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        { email: user.email },
        process.env.ACCESS_TOKEN_SECRET
      );

      res.cookie("_et", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      }); // Sending the token as a cookie (secure and httponly)
      res.send({ token });
    });

    app.delete("/jwt", async (req, res) => {
      try {
        const _et = req.cookies._et;
        // console.log(_et)

        res.clearCookie("_et");
        // console.log(3)
        res.status(200).send(true);
      } catch {
        (e) => {
          res.status(500).send({ message: "Internal server error" });
        };
      }
    });

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.data;
      const email = decodedEmail;
      // console.log(email)
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }

      next();
    };

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      console.log(result);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      console.log(query);
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.data;
      if (decodedEmail !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const user = req.body;
      // console.log(user)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // ----------------------------------Upload Profile------------------------------

    app.get('/get-profile/:email', async (req, res) => {
      const email = req.params.email;

      // Get the user's profile based on their email
      try {
        const userProfile = await profileCollection.findOne({ email: email });

        if (userProfile) {
          res.status(200).json(userProfile);
        } else {
          res.status(404).json({ message: 'User profile not found' });
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.post('/upload-profile', verifyJWT, async (req, res) => {
      const newProfile = req.body;
      const existingProfile = await profileCollection.findOne({ email: newProfile.email });

      if (existingProfile) {
        // Profile with the email already exists, update the information
        const result = await profileCollection.updateOne(
          { email: newProfile.email },
          { $set: newProfile }
        );

        if (result.modifiedCount === 1) {
          res.status(200).send({ message: 'Profile updated successfully' });
        } else {
          res.status(500).send({ message: 'Failed to update profile' });
        }
      } else {
        // Profile with the email doesn't exist, create a new profile
        const result = await profileCollection.insertOne(newProfile);

        if (result.insertedCount === 1) {
          res.status(200).send({ message: 'Profile created successfully' });
        } else {
          res.status(500).send({ message: 'Failed to create profile' });
        }
      }
    });


    //-----------------------------Address---------------------------------

    app.get("/address", async (req, res) => {
      const result = await deliveryChargeCollection.find().toArray();
      //console.log(result);
      res.send(result);
    });



    //----------------------------- Products ----------------------------------

    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });

    app.get("/products/:id", async (req, res) => {
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

    app.post("/products", verifyJWT, verifyAdmin, async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    app.patch("/products/:id", verifyJWT, async (req, res) => {
      const productIdToUpdate = req.params.productId;
      const { rating, comment } = req.body;

      try {
        // Prepare the fields to update (using $set)
        const updateFields = {};
        if (rating !== undefined) {
          updateFields.rating = rating;
        }
        if (comment !== undefined) {
          updateFields.comment = comment;
        }

        // Update the product document that matches the ID
        const result = await productsCollection.updateOne(
          { _id: ObjectId(productIdToUpdate) },
          { $set: updateFields }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Product not found." });
        }

        res.json({ message: "Product updated successfully.", result });
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Error updating product." });
      }
    });


    // --------------------------------Delivery Charge -------------------------------


    app.get("/get-delivery-charge", async (req, res) => {
      const query = {};
      const cursor = deliveryChargeCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });


    app.post('/delivery-charge', verifyJWT, async (req, res) => {
      const newDeliveryCharge = req.body;
      
      const existingDeliveryCharge = await deliveryChargeCollection.findOne({ name: newDeliveryCharge?.name });
    
      if (!existingDeliveryCharge) {
        res.status(404).send('error occured ')
      }
    


      const result = await deliveryChargeCollection.updateOne(
        { name: newDeliveryCharge.name },
        { $set: newDeliveryCharge }
      );

      if (result.modifiedCount === 1) {
        res.status(200).send({ message: 'Delivery Charge updated successfully' });
      } else {
        res.status(500).send({ message: 'Failed to update Delivery Charge' });
      }



    });


    //--------------------------------Coupon Code -----------------------------

    app.post("/coupon", verifyJWT, async (req, res) => {
      const newCoupon = req.body;
      console.log(newCoupon, "new");
      const exist = await couponsCollection.findOne({
        couponCode: newCoupon?.couponCode,
      });
      if (exist) {
        res.status(409).send({ message: "Coupon Code already existed" });
      } else {
        const result = await couponsCollection.insertOne(newCoupon);
        res.status(200).send(result);
      }
    });


    //------------------------------------- Categories ---------------------------

    app.get("/categories", async (req, res) => {
      const query = {};
      const cursor = categoryCollection.find(query);
      const categories = await cursor.toArray();
      res.send(categories);
    });

    app.get("/categories/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const category = await categoryCollection.findOne(query);
        if (category) {
          res.send(category);
        } else {
          res.status(404).send({ message: "Category not found." });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error." });
      }
    });

    app.post("/categories", verifyJWT, verifyAdmin, async (req, res) => {
      const newCategory = req.body;
      console.log(newCategory, "new");
      const exist = await categoryCollection.findOne({
        slug: newCategory?.slug,
      });
      if (exist) {
        res.status(409).send({ message: "Category Name already existed" });
      } else {
        const result = await categoryCollection.insertOne(newCategory);
        res.status(200).send(result);
      }
    });

    app.patch(
      "/upload-category/:slug",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const categorySlugToUpdate = req.params.slug;
        const {
          topBannerImage,
          secondBannerImage,
          topRightBannerLayout2,
          topLeftBannerLayout2,
          slimBannerImage,
          headingsSlim,
          titleSlim,
          offerSlim,
          bottomBannerImage,
        } = req.body;

        try {
          // Prepare the fields to update (both topBannerImage and secondBannerImage)
          const updateFields = {};

          if (topBannerImage) {
            // Use the $push operator to append the new image to the existing array
            updateFields.$push = { topBannerImage };
          }
          if (secondBannerImage) {
            updateFields.$push = { secondBannerImage };
          }
          if (topRightBannerLayout2) {
            updateFields.$push = { topRightBannerLayout2 };
          }
          if (topLeftBannerLayout2) {
            updateFields.$push = { topLeftBannerLayout2 };
          }
          if ((slimBannerImage, headingsSlim, titleSlim, offerSlim)) {
            updateFields.$push = {
              slimBannerImage,
              headingsSlim,
              titleSlim,
              offerSlim,
            };
          }
          if (bottomBannerImage) {
            updateFields.$push = { bottomBannerImage };
          }

          // Update the category document that matches the slug
          const result = await categoryCollection.updateOne(
            { slug: categorySlugToUpdate },
            updateFields
          );

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Category not found." });
          }

          res.json({ message: "Category updated successfully.", result });
        } catch (error) {
          console.error("Error updating category:", error);
          res.status(500).json({ message: "Error updating category." });
        }
      }
    );

    app.patch(
      "/upload-category/:slug/layout",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const categorySlugToUpdate = req.params.slug;
        console.log(req.params);
        const { layout } = req.body;

        try {
          // Update the 'layout' field for the category that matches the slug
          const result = await categoryCollection.updateOne(
            { slug: categorySlugToUpdate },
            { $set: { layout: layout } }
          );
          console.log(result);

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Category not found." });
          }

          return res.json({
            message: "Category layout updated successfully.",
            category: result,
          });
        } catch (error) {
          console.error("Error updating category layout:", error);
          res.status(500).json({ message: "Error updating category layout." });
        }
      }
    );

    app.get("/upload-category/:slug/upload-top-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        console.log("categorySlugToRetrieve:", categorySlugToRetrieve);

        const category = await categoryCollection.findOne({
          slug: categorySlugToRetrieve,
        });

        console.log("category:", category);

        if (!category) {
          return res.status(404).json({ message: "Category not found." });
        }

        res.status(200).send(category);
      } catch (error) {
        console.error("Error retrieving category:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/upload-category/:slug/upload-second-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        console.log("categorySlugToRetrieve:", categorySlugToRetrieve);

        const category = await categoryCollection.findOne({
          slug: categorySlugToRetrieve,
        });

        console.log("category:", category);

        if (!category) {
          return res.status(404).json({ message: "Category not found." });
        }

        res.status(200).send(category);
      } catch (error) {
        console.error("Error retrieving category:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get(
      "/upload-category/:slug/upload-top-right-banner-layout2",
      async (req, res) => {
        try {
          const categorySlugToRetrieve = req.params.slug;
          console.log("categorySlugToRetrieve:", categorySlugToRetrieve);

          const category = await categoryCollection.findOne({
            slug: categorySlugToRetrieve,
          });

          console.log("category:", category);

          if (!category) {
            return res.status(404).json({ message: "Category not found." });
          }

          res.status(200).send(category);
        } catch (error) {
          console.error("Error retrieving category:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-category/:slug/upload-top-left-banner-layout2",
      async (req, res) => {
        try {
          const categorySlugToRetrieve = req.params.slug;
          console.log("categorySlugToRetrieve:", categorySlugToRetrieve);

          const category = await categoryCollection.findOne({
            slug: categorySlugToRetrieve,
          });

          console.log("category:", category);

          if (!category) {
            return res.status(404).json({ message: "Category not found." });
          }

          res.status(200).send(category);
        } catch (error) {
          console.error("Error retrieving category:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get("/upload-category/:slug/upload-slim-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        console.log("categorySlugToRetrieve:", categorySlugToRetrieve);

        const category = await categoryCollection.findOne({
          slug: categorySlugToRetrieve,
        });

        console.log("category:", category);

        if (!category) {
          return res.status(404).json({ message: "Category not found." });
        }

        res.status(200).send(category);
      } catch (error) {
        console.error("Error retrieving category:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/upload-category/:slug/upload-bottom-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        console.log("categorySlugToRetrieve:", categorySlugToRetrieve);

        const category = await categoryCollection.findOne({
          slug: categorySlugToRetrieve,
        });

        console.log("category:", category);

        if (!category) {
          return res.status(404).json({ message: "Category not found." });
        }

        res.status(200).send(category);
      } catch (error) {
        console.error("Error retrieving category:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/sub-category", async (req, res) => {
      const query = {};
      const cursor = subCategoryCollection.find(query);
      const subCategory = await cursor.toArray();
      res.send(subCategory);
    });

    app.post(
      "/upload-sub-category",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const newSubCategory = req.body;
        console.log(newSubCategory, "new");
        const exist = await subCategoryCollection.findOne({
          slug: newSubCategory?.slug,
        });
        if (exist) {
          res
            .status(409)
            .send({ message: "Sub Category Name already existed" });
        } else {
          const result = await subCategoryCollection.insertOne(newSubCategory);
          res.status(200).send(result);
        }
      }
    );

    app.patch(
      "/upload-sub-category/:slug/layout",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const subCategorySlugToUpdate = req.params.slug;
        console.log(req.params);
        const { layout } = req.body;

        try {
          // Update the 'layout' field for the category that matches the slug
          const result = await subCategoryCollection.updateOne(
            { slug: subCategorySlugToUpdate },
            { $set: { layout: layout } }
          );
          console.log(result);

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Category not found." });
          }

          return res.json({
            message: "Category layout updated successfully.",
            category: result,
          });
        } catch (error) {
          console.error("Error updating category layout:", error);
          res.status(500).json({ message: "Error updating category layout." });
        }
      }
    );

    app.patch(
      "/upload-sub-category/:slug",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const subCategorySlugToUpdate = req.params.slug;
        const {
          topBannerImage,
          secondBannerImage,
          topRightBannerLayout2,
          topLeftBannerLayout2,
          slimBannerImage,
        } = req.body;

        try {
          // Prepare the fields to update (both topBannerImage and secondBannerImage)
          const updateFields = {};

          if (topBannerImage) {
            // Use the $push operator to append the new image to the existing array
            updateFields.$push = { topBannerImage };
          }
          if (secondBannerImage) {
            updateFields.$push = { secondBannerImage };
          }
          if (topRightBannerLayout2) {
            updateFields.$push = { topRightBannerLayout2 };
          }
          if (topLeftBannerLayout2) {
            updateFields.$push = { topLeftBannerLayout2 };
          }
          if (slimBannerImage) {
            updateFields.$push = { slimBannerImage };
          }

          // Update the category document that matches the slug
          const result = await subCategoryCollection.updateOne(
            { slug: subCategorySlugToUpdate },
            updateFields
          );

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "subCategory not found." });
          }

          res.json({ message: "subCategory updated successfully.", result });
        } catch (error) {
          console.error("Error updating subcategory:", error);
          res.status(500).json({ message: "Error updating subcategory." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-top-banner",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne({
            slug: subCategorySlugToRetrieve,
          });

          console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }

          res.status(200).send(subCategory);
        } catch (error) {
          console.error("Error retrieving subcategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-top-right-banner-layout2",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          console.log("subCategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne({
            slug: subCategorySlugToRetrieve,
          });

          console.log("subCategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }

          res.status(200).send(subCategory);
        } catch (error) {
          console.error("Error retrieving subCategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-top-left-banner-layout2",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          console.log("categorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne({
            slug: subCategorySlugToRetrieve,
          });

          console.log("category:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }

          res.status(200).send(subCategory);
        } catch (error) {
          console.error("Error retrieving subCategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-slim-banner",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          console.log("categorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne({
            slug: subCategorySlugToRetrieve,
          });

          console.log("subCategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }

          res.status(200).send(subCategory);
        } catch (error) {
          console.error("Error retrieving subCategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get("/menCategory", async (req, res) => {
      const query = {};
      const cursor = menCategoryCollection.find(query);
      const menCategory = await cursor.toArray();
      res.send(menCategory);
    });

    app.get("/womenCategory", async (req, res) => {
      const query = {};
      const cursor = womenCategoryCollection.find(query);
      const womenCategory = await cursor.toArray();
      res.send(womenCategory);
    });

    app.get("/groceryCategory", async (req, res) => {
      const query = {};
      const cursor = groceryCategoryCollection.find(query);
      const groceryCategory = await cursor.toArray();
      res.send(groceryCategory);
    });

    app.get("/beautyCategory", async (req, res) => {
      const query = {};
      const cursor = beautyCategoryCollection.find(query);
      const beautyCategory = await cursor.toArray();
      res.send(beautyCategory);
    });

    // app.get('/carts', async (req, res) => {
    //     const email = req.query.email;

    //     if (!email) {
    //       res.send([]);
    //     }
    //     const query = { email: email };
    //     const result = await cartCollection.find(query).toArray();
    //     res.send(result);
    //   });

    /*
       __________________________________ CART MANAGEMENT _________________________________
    */

    // app.get('/carts', verifyJWT, async (req, res) => {
    //   const email = req.query.email;

    //   if (!email) {
    //     res.status(401).send([]);
    //   }
    //   const decodedEmail = req.data;
    //   // console.log(req.data)
    //   // console.log(5, decodedEmail)
    //   if (email !== decodedEmail) {
    //     return res.status(401).send({ error: true, message: 'unauthorized' })
    //   }
    //   const query = { email: email };
    //   const result = await cartCollection.find(query).toArray();
    //   res.send(result);
    // });

    //Get user's cart with product details
    app.get("/get-cart", verifyJWT, async (req, res) => {
      const decodedEmail = req.data;
      const email = req.query.email;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauthorized access from this email" });
      }

      try {
        const cart = await cartCollection.findOne({ email });

        const cartItemsWithDetails = await Promise.all(
          cart.cart.map(async (item) => {
            const product = await productsCollection.findOne(
              { _id: new ObjectId(item.productId) },
              {
                projection: {
                  productTitle: 1,
                  image: 1,
                  mainPrice: 1,
                  price: 1,
                  stock: 1,
                },
              }
            );

            return {
              _id: product?._id,
              productTitle: product?.productTitle,
              image: product?.image,
              mainPrice: parseFloat(product?.mainPrice || 0),
              price: parseFloat(product?.price || 0),
              quantity: item?.quantity,
              stock: product?.stock,
              checked: item?.checked
            };
          })
        );

        res.status(200).json({ cart: cartItemsWithDetails });
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Add item to cart
    app.post("/add-to-cart", verifyJWT, async (req, res) => {
      const decodedEmail = req.data;
      // console.log(decodedEmail);
      const { email, productId, quantity, checked } = req.body;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauathorized access from this email" });
      }

      try {
        let cart = await cartCollection.findOne({ email });

        if (!cart) {
          cart = { email, cart: [] };
        }

        const existingItemIndex = cart.cart.findIndex(
          (item) => item.productId.toString() === productId
        );
        if (existingItemIndex !== -1) {
          cart.cart[existingItemIndex].quantity += quantity;
        } else {
          cart.cart.push({ productId, quantity, checked });
        }

        await cartCollection.updateOne(
          { email },
          { $set: cart },
          { upsert: true }
        );


        res.status(200).send(true);
        // res.status(201).json(cart);
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Update cart product with new quantity and checked status
    app.put("/update-cart-product/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.data;
      const { email, productId, quantity, checked } = req.body;
      // console.log(email, productId, quantity, checked, 9);

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "Unauthorized access from this email" });
        return;
      }

      try {
        let cart = await cartCollection.findOne({ email });

        if (!cart) {
          cart = { email, cart: [] };
        }

        const existingItemIndex = cart.cart.findIndex(
          (item) => item.productId.toString() === productId
        );
        if (existingItemIndex !== -1) {
          cart.cart[existingItemIndex].quantity = quantity;

          cart.cart[existingItemIndex].checked = checked;

        }
        // console.log(cart)
        await cartCollection.updateOne(
          { email },
          { $set: cart },
          { upsert: true }
        );

        res.status(200).json(cart);
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // app.post('/carts', verifyJWT, async (req, res) => {
    //   const decodedEmail = req.data;
    //   console.log(decodedEmail)
    //   const product = req.body;
    //   const result = await cartCollection.insertOne(product);
    //   res.send(result);
    // })

    app.delete(
      "/remove-from-cart/:email/:productId",
      verifyJWT,
      async (req, res) => {
        const { email, productId } = req.params;

        const decodedEmail = req.data;

        try {
          if (decodedEmail !== email) {
            res
              .status(401)
              .send({ message: "unauthorized access from this email" });
          }

          const result = await cartCollection.updateOne(
            { email },
            { $pull: { cart: { productId } } }
          );

          if (result.modifiedCount === 1) {
            res.json({ message: "Item removed from cart successfully" });
          } else {
            res.status(404).json({ error: "Item not found in cart" });
          }
        } catch (error) {
          res.status(500).json({ error: "An error occurred" });
        }
      }
    );

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("hello");
});

app.listen(port, () => {
  console.log(`listening to port ${port}`);
});
