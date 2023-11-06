const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
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

const auth = {
  auth: {
    api_key: process.env.EMAIL_PRIVATE_KEY,
    domain: process.env.EMAIL_DOMAIN,
  },
};

function checkPermission(allowedRoles) {
  return (req, res, next) => {
    const user = req.data;
    console.log(user?.role, allowedRoles, req.path);
    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      return res.sendStatus(403); // Forbidden
    }
    next();
  };
}

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
    req.data = decodedToken; // Assuming the email is stored in the token's payload
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
    const deliveryChargeCollection = client
      .db("e-mart")
      .collection("deliveryCharge");
    const couponsCollection = client.db("e-mart").collection("coupons");
    const ordersCollection = client.db("e-mart").collection("ordersCollection");
    const categoryCollection = client.db("e-mart").collection("category");
    const subCategoryCollection = client.db("e-mart").collection("subCategory");
    const productsCollection = client.db("e-mart").collection("products");
    const reviewsCollection = client.db("e-mart").collection("reviews");
    const bannersCollection = client.db("e-mart").collection("banners");
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
    const wishListCollection = client.db("e-mart").collection("wishList");
    const cartCollection = client.db("e-mart").collection("carts");
    const paymentCollection = client.db("e-mart").collection("payments");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      let userData = await userCollection.findOne({ email: user?.email });
      console.log(135, userData);
      if (!userData) {
        userData = {
          email: user?.email,
          name: user?.displayName,
          role: "user",
        };
        await userCollection.insertOne(userData);
        await profileCollection.insertOne(userData);
      }
      const token = jwt.sign(userData, process.env.ACCESS_TOKEN_SECRET);
      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decodedToken) => {
          if (err) {
            //return res.status(403).json({ message: "Invalid token." });
          }
          console.log(144, decodedToken);
          //req.data = decodedToken; // Assuming the email is stored in the token's payload
          // next();
        }
      );
      console.log("JWT", token);

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
      const decodedEmail = req.data?.email;
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

    app.get(
      "/users",
      verifyJWT,
      checkPermission(["admin"]),
      async (req, res) => {
        const result = await userCollection
          .find({ email: { $ne: req.query?.email } })
          .toArray();
        //console.log(result);
        res.send(result);
      }
    );

    app.patch(
      "/admin/admin-list/:userId/edit-role",
      verifyJWT,
      checkPermission(["admin"]),
      async (req, res) => {
        try {
          const data = req.body;
          const userId = req.params.userId;
          console.log(userId);
          const user = await userCollection.findOne({
            _id: new ObjectId(userId),
          });
          console.log("user --", user);
          if (!user) {
            return res.status(404).send({ message: "User not found" });
          }
          const result = await userCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { role: data?.role ? data?.role : "user" } }
          );
          //const updatedUser = await userCollection.findOne({id: new ObjectId(userId)});
          res.status(200).send(result);
        } catch {}
      }
    );

    app.post("/users", async (req, res) => {
      const user = req.body;
      //console.log(user);
      const query = { email: user.email };
      //console.log(query);
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const userData = { ...user, role: "user" };
      const result = await userCollection.insertOne(userData);
      const data = {
        name: user?.name,
        email: user?.email,
        img: "",
        address: "",
        city: "",
        phone: "",
        slug: "",
        coupon: [],
        coin: 0,
      };
      await profileCollection.insertOne(data);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.data?.email;
      if (decodedEmail !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
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

    app.get("/get-profile/:email", verifyJWT, async (req, res) => {
      const email = req?.params?.email;

      // Get the user's profile based on their email
      try {
        const userProfile = await profileCollection.findOne({ email: email });

        if (userProfile) {
          res.status(200).json(userProfile);
        } else {
          res.status(404).json({ message: "User profile not found" });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/get-user-role/:email", async (req, res) => {
      const email = req?.params?.email;
      //console.log('/get-user-role')
      // Get the user's profile based on their email
      try {
        const userProfile = await userCollection.findOne({ email: email });

        if (userProfile) {
          res.status(200).json({ user: userProfile });
        } else {
          res.status(404).json({ message: "User profile not found" });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/upload-profile", verifyJWT, async (req, res) => {
      const newProfile = req.body;
      const existingProfile = await profileCollection.findOne({
        email: newProfile?.email,
      });

      if (existingProfile) {
        // Profile with the email already exists, update the information
        const result = await profileCollection.updateOne(
          { email: newProfile?.email },
          { $set: newProfile }
        );

        if (result?.modifiedCount === 1) {
          res.status(200).send({ message: "Profile updated successfully" });
        } else {
          res.status(500).send({ message: "Failed to update profile" });
        }
      } else {
        // Profile with the email doesn't exist, create a new profile
        const result = await profileCollection.insertOne(newProfile);

        if (result?.insertedCount === 1) {
          res.status(200).send({ message: "Profile created successfully" });
        } else {
          res.status(500).send({ message: "Failed to create profile" });
        }
      }
    });

    //-----------------------------Address---------------------------------

    app.get("/address", async (req, res) => {
      const result = await deliveryChargeCollection.find().toArray();
      //console.log(result);
      res.send(result);
    });

    ///--------------------------Home page Banners------------------------------------

    app.post(
      "/home-top-banners",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const newBanner = req.body;
        const result = await bannersCollection.insertOne(newBanner);
        res.send(result);
      }
    );

    app.patch(
      "/home-top-banners/:slug",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const homeSlug = req.params.slug;
        const { topBannerImage, secondBannerImage, bottomBannerImage } =
          req.body;

        try {
          // Prepare the fields to update (both topBannerImage and secondBannerImage)
          const updateFields = {};

          if (topBannerImage) {
            // Use the $push operator to append the new image to the existing array
            updateFields.$push = { topBannerImage };
          }
          if (secondBannerImage) {
            // Use the $push operator to append the new image to the existing array
            updateFields.$push = { secondBannerImage };
          }
          if (bottomBannerImage) {
            // Use the $push operator to append the new image to the existing array
            updateFields.$push = { bottomBannerImage };
          }

          // Update the category document that matches the slug
          const result = await bannersCollection.updateOne(
            { slug: homeSlug },
            updateFields
          );

          if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Banners not found." });
          }

          res.json({ message: "Banners updated successfully.", result });
        } catch (error) {
          console.error("Error updating banners:", error);
          res.status(500).json({ message: "Error updating banners." });
        }
      }
    );

    app.get("/home-top-banners/:slug/top-banner", async (req, res) => {
      try {
        const homeSlug = req.params.slug;
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const banner = await bannersCollection.findOne(
          {
            slug: homeSlug,
          },
          { projection: { _id: 1, topBannerImage: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!banner) {
          return res.status(404).json({ message: "banner not found." });
        }
        if (!banner?.topBannerImage) {
          return res.status(200).send([]);
        }
        res.status(200).send(banner?.topBannerImage);
      } catch (error) {
        console.error("Error retrieving banner:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/home-second-banners/:slug/second-banner", async (req, res) => {
      try {
        const homeSlug = req.params.slug;
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const banner = await bannersCollection.findOne(
          {
            slug: homeSlug,
          },
          { projection: { _id: 1, secondBannerImage: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!banner) {
          return res.status(404).json({ message: "banner not found." });
        }
        if (!banner?.secondBannerImage) {
          return res.status(200).send([]);
        }
        res.status(200).send(banner?.secondBannerImage);
      } catch (error) {
        console.error("Error retrieving banner:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/home-bottom-banners/:slug/bottom-banner", async (req, res) => {
      try {
        const homeSlug = req.params.slug;
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const banner = await bannersCollection.findOne(
          {
            slug: homeSlug,
          },
          { projection: { _id: 1, bottomBannerImage: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!banner) {
          return res.status(404).json({ message: "banner not found." });
        }
        if (!banner?.bottomBannerImage) {
          return res.status(200).send([]);
        }
        res.status(200).send(banner?.bottomBannerImage);
      } catch (error) {
        console.error("Error retrieving banner:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    //----------------------------- Products ----------------------------------

    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();

      // Fetch reviews for each product
      const productsWithReviews = [];
      for (const product of products) {
        const reviewsQuery = { productId: product._id }; // Assuming you have a field named "productId" in your reviews
        const reviews = await reviewsCollection.find(reviewsQuery).toArray();
        product.reviews = reviews;
        productsWithReviews.push(product);
      }

      res.send(productsWithReviews);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const product = await productsCollection.findOne(query);

        if (product) {
          // Fetch the reviews for the product from the reviewsCollection
          const reviewsQuery = { productId: product._id }; // Assuming you have a field named "productId" in your reviews
          const reviews = await reviewsCollection.find(reviewsQuery).toArray();

          // Add the reviews array to the product data
          product.reviews = reviews;

          res.send(product);
        } else {
          res.status(404).send({ message: "Product not found." });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error." });
      }
    });

    app.post(
      "/products",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const newProduct = req.body;
        const result = await productsCollection.insertOne(newProduct);
        res.send(result);
      }
    );

    app.put("/products/:id", verifyJWT, checkPermission(["admin", "Product Manager"]), async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body; // Updated product data
      try {
        const query = { _id: new ObjectId(id) };
        const result = await productsCollection.updateOne(query, { $set: updatedProduct });
    
        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Product updated successfully" });
        } else {
          res.status(404).send({ message: "Product not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });
    

    app.patch(
      "/products/:id",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
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
      }
    );

    //Reviews

    app.get("/products/:id/reviews", async (req, res) => {
      const productIdToRetrieve = req.params.id;
      try {
        // Find reviews for the product with the specified ID
        const reviews = await reviewsCollection
          .find({ productId: new ObjectId(productIdToRetrieve) })
          .toArray();
        if (reviews.length === 0) {
          return res
            .status(404)
            .json({ message: "No reviews found for this product." });
        }
        res.json({ reviews });
      } catch (error) {
        console.error("Error retrieving reviews:", error);
        res.status(500).json({ message: "Error retrieving reviews." });
      }
    });

    app.post("/products/:id/reviews", verifyJWT, async (req, res) => {
      const productIdToUpdate = req.params.id;
      const { email, name, rating, comment } = req.body;
      try {
        // Check if the product with the specified ID exists
        const product = await productsCollection.findOne({
          _id: new ObjectId(productIdToUpdate),
        });
        if (!product) {
          return res.status(404).json({ message: "Product not found." });
        }
        // Create a new review object
        const review = {
          productId: new ObjectId(productIdToUpdate), // Reference to the product
          rating,
          comment,
          name,
          email,
          createdAt: new Date(),
        };
        // Insert the review document into the reviewsCollection
        const result = await reviewsCollection.insertOne(review);
        res.json({ message: "Review added successfully.", result });
      } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ message: "Error adding review." });
      }
    });

    // --------------------------------Delivery Charge -------------------------------

    app.get("/get-delivery-charge/:location", async (req, res) => {
      const query = {};
      const cursor = deliveryChargeCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/delivery-charge", verifyJWT, async (req, res) => {
      const newDeliveryCharge = req.body;

      const existingDeliveryCharge = await deliveryChargeCollection.findOne({
        name: newDeliveryCharge?.name,
      });

      if (!existingDeliveryCharge) {
        res.status(404).send("error occured ");
      }

      const result = await deliveryChargeCollection.updateOne(
        { name: newDeliveryCharge.name },
        { $set: newDeliveryCharge }
      );

      if (result.modifiedCount === 1) {
        res
          .status(200)
          .send({ message: "Delivery Charge updated successfully" });
      } else {
        res.status(500).send({ message: "Failed to update Delivery Charge" });
      }
    });

    //--------------------------------Coupon Code -----------------------------

    app.get("/get-coupon", async (req, res) => {
      const query = {};
      const cursor = couponsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

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

    app.delete("/delete-coupon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponsCollection.deleteOne(query);
      res.send(result);
    });

    //------------------------------------- Categories ---------------------------

    app.get("/categories", async (req, res) => {
      const query = {};
      const cursor = categoryCollection.find(query);
      const categories = await cursor.toArray();
      res.send(categories);
    });

    app.get("/categories/:slug", async (req, res) => {
      const slug = req.params.slug;
      try {
        const query = { slug: slug };
        const category = await categoryCollection.findOne(query);

        if (!category) {
          return res.status(404).send({ message: "Category not found." });
        }

        const subCategories = await subCategoryCollection
          .find({ category: category.name })
          .toArray();

        const products = await productsCollection
          .find({ category: category.name })
          .toArray();

        // Fetch reviews for each product
        const productsWithReviews = [];
        for (const product of products) {
          const reviewsQuery = { productId: product._id }; // Assuming you have a field named "productId" in your reviews
          const reviews = await reviewsCollection.find(reviewsQuery).toArray();
          product.reviews = reviews;
          productsWithReviews.push(product);
        }

        res.send({
          category: category,
          subcategory: subCategories,
          products: productsWithReviews,
        });
      } catch (error) {
        res.status(500).send({ message: "Internal server error." });
      }
    });

    app.post(
      "/categories",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
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
      }
    );

    app.patch(
      "/upload-category/:slug",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
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
          if (slimBannerImage || headingsSlim || titleSlim || offerSlim) {
            // Create an array with the values
            const slimBannerData = {
              slimBannerImage,
              headingsSlim,
              titleSlim,
              offerSlim,
            };

            // Use $push to append the slimBannerData object to the existing array
            updateFields.$push = { slimBanners: slimBannerData };
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

    app.delete(
      "/delete-top-banner/:slug/:index",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const categorySlugToUpdate = req.params.slug;
        const { index } = req.params; // Get the index of the image to delete

        try {
          // Find the category document by slug
          const category = await categoryCollection.findOne({
            slug: categorySlugToUpdate,
          });

          if (!category) {
            return res.status(404).json({ message: "Category not found." });
          }

          // Check if the index is within the valid range
          if (index < 0 || index >= category.topBannerImage.length) {
            return res.status(400).json({ message: "Invalid index." });
          }

          // Remove the image at the specified index
          category.topBannerImage.splice(index, 1);

          // Update the category document with the modified topBannerImage array
          const result = await categoryCollection.updateOne(
            { slug: categorySlugToUpdate },
            { $set: { topBannerImage: category.topBannerImage } }
          );

          res.json({ message: "Image deleted successfully.", result });
        } catch (error) {
          console.error("Error deleting image:", error);
          res.status(500).json({ message: "Error deleting image." });
        }
      }
    );

    app.patch(
      "/upload-category/:slug/layout",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
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
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const category = await categoryCollection.findOne(
          {
            slug: categorySlugToRetrieve,
          },
          { projection: { _id: 1, topBannerImage: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!category) {
          return res.status(404).json({ message: "category not found." });
        }
        if (!category?.topBannerImage) {
          return res.status(200).send([]);
        }
        res.status(200).send(category?.topBannerImage);
      } catch (error) {
        console.error("Error retrieving category:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/upload-category/:slug/upload-second-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const category = await categoryCollection.findOne(
          {
            slug: categorySlugToRetrieve,
          },
          { projection: { _id: 1, secondBannerImage: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!category) {
          return res.status(404).json({ message: "category not found." });
        }
        if (!category?.secondBannerImage) {
          return res.status(200).send([]);
        }
        res.status(200).send(category?.secondBannerImage);
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
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const category = await categoryCollection.findOne(
            {
              slug: categorySlugToRetrieve,
            },
            { projection: { _id: 1, topRightBannerLayout2: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!category) {
            return res.status(404).json({ message: "category not found." });
          }
          if (!category?.topRightBannerLayout2) {
            return res.status(200).send([]);
          }
          res.status(200).send(category?.topRightBannerLayout2);
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
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const category = await categoryCollection.findOne(
            {
              slug: categorySlugToRetrieve,
            },
            { projection: { _id: 1, topLeftBannerLayout2: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!category) {
            return res.status(404).json({ message: "category not found." });
          }
          if (!category?.topLeftBannerLayout2) {
            return res.status(200).send([]);
          }
          res.status(200).send(category?.topLeftBannerLayout2);
        } catch (error) {
          console.error("Error retrieving category:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get("/upload-category/:slug/upload-slim-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const category = await categoryCollection.findOne(
          {
            slug: categorySlugToRetrieve,
          },
          { projection: { _id: 1, slimBanners: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!category) {
          return res.status(404).json({ message: "category not found." });
        }
        if (!category?.slimBanners) {
          return res.status(200).send([]);
        }
        res.status(200).send(category?.slimBanners);
      } catch (error) {
        console.error("Error retrieving category:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/upload-category/:slug/upload-bottom-banner", async (req, res) => {
      try {
        const categorySlugToRetrieve = req.params.slug;
        //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

        const category = await categoryCollection.findOne(
          {
            slug: categorySlugToRetrieve,
          },
          { projection: { _id: 1, bottomBannerImage: 1 } }
        );

        // console.log("subcategory:", subCategory);

        if (!category) {
          return res.status(404).json({ message: "category not found." });
        }
        if (!category?.bottomBannerImage) {
          return res.status(200).send([]);
        }
        res.status(200).send(category?.bottomBannerImage);
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

    app.get("/sub-categories", async (req, res) => {
      const categoryName = req.query.category; // Get the category name from the query parameter

      try {
        let query = {}; // Default query to retrieve all subcategories

        if (categoryName) {
          // If a category name is provided, filter by it
          query = { category: categoryName };
        }

        const subCategories = await subCategoryCollection.find(query).toArray();

        res.status(200).json(subCategories);
      } catch (error) {
        console.error("Error retrieving subcategories:", error);
        res.status(500).json({ message: "Error retrieving subcategories." });
      }
    });

    app.get("/sub-categories/:slug", async (req, res) => {
      const slug = req.params.slug;
      try {
        const query = { slug: slug };
        const subCategory = await subCategoryCollection.findOne(query);

        if (!subCategory) {
          return res.status(404).send({ message: "SubCategory not found." });
        }

        const products = await productsCollection
          .find({ subCategory: subCategory.name })
          .toArray();

        // Fetch reviews for each product
        const productsWithReviews = [];
        for (const product of products) {
          const reviewsQuery = { productId: product._id }; // Assuming you have a field named "productId" in your reviews
          const reviews = await reviewsCollection.find(reviewsQuery).toArray();
          product.reviews = reviews;
          productsWithReviews.push(product);
        }

        res.send({ subCategory: subCategory, products: productsWithReviews });
      } catch (error) {
        res.status(500).send({ message: "Internal server error." });
      }
    });

    app.post(
      "/upload-sub-category",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const newSubCategory = req.body;
        //console.log(newSubCategory, "new");
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
      checkPermission(["admin", "Product Manager"]),
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
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const subCategorySlugToUpdate = req.params.slug;
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
          if (slimBannerImage || headingsSlim || titleSlim || offerSlim) {
            // Create an array with the values
            const slimBannerData = {
              slimBannerImage,
              headingsSlim,
              titleSlim,
              offerSlim,
            };

            // Use $push to append the slimBannerData object to the existing array
            updateFields.$push = { slimBanners: slimBannerData };
          }
          if (bottomBannerImage) {
            updateFields.$push = { bottomBannerImage };
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
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne(
            {
              slug: subCategorySlugToRetrieve,
            },
            { projection: { _id: 1, topBannerImage: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }
          if (!subCategory?.topBannerImage) {
            return res.status(200).send([]);
          }
          res.status(200).send(subCategory?.topBannerImage);
        } catch (error) {
          console.error("Error retrieving subcategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-second-banner",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne(
            {
              slug: subCategorySlugToRetrieve,
            },
            { projection: { _id: 1, secondBannerImage: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "category not found." });
          }
          if (!subCategory?.secondBannerImage) {
            return res.status(200).send([]);
          }
          res.status(200).send(subCategory?.secondBannerImage);
        } catch (error) {
          console.error("Error retrieving subCategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-top-right-banner-layout2",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne(
            {
              slug: subCategorySlugToRetrieve,
            },
            { projection: { _id: 1, topRightBannerLayout2: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }
          if (!subCategory?.topRightBannerLayout2) {
            return res.status(200).send([]);
          }
          res.status(200).send(subCategory?.topRightBannerLayout2);
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
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne(
            {
              slug: subCategorySlugToRetrieve,
            },
            { projection: { _id: 1, topLeftBannerLayout2: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }
          if (!subCategory?.topLeftBannerLayout2) {
            return res.status(200).send([]);
          }
          res.status(200).send(subCategory?.topLeftBannerLayout2);
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
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne(
            {
              slug: subCategorySlugToRetrieve,
            },
            { projection: { _id: 1, slimBanners: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }
          if (!subCategory?.slimBanners) {
            return res.status(200).send([]);
          }
          res.status(200).send(subCategory?.slimBanners);
        } catch (error) {
          console.error("Error retrieving subCategory:", error);
          res.status(500).json({ message: "Internal server error." });
        }
      }
    );

    app.get(
      "/upload-sub-category/:slug/upload-bottom-banner",
      async (req, res) => {
        try {
          const subCategorySlugToRetrieve = req.params.slug;
          //console.log("subcategorySlugToRetrieve:", subCategorySlugToRetrieve);

          const subCategory = await subCategoryCollection.findOne(
            {
              slug: subCategorySlugToRetrieve,
            },
            { projection: { _id: 1, bottomBannerImage: 1 } }
          );

          // console.log("subcategory:", subCategory);

          if (!subCategory) {
            return res.status(404).json({ message: "subCategory not found." });
          }
          if (!subCategory?.bottomBannerImage) {
            return res.status(200).send([]);
          }
          res.status(200).send(subCategory?.bottomBannerImage);
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

    //-----------------------------Wish List---------------------------------

    //Get user's cart with product details
    app.get("/get-wish-list", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauthorized access from this email" });
      }

      try {
        const wishList = await wishListCollection.findOne({ email });

        const wishListItemsWithDetails = await Promise.all(
          wishList.wishList.map(async (item) => {
            const product = await productsCollection.findOne(
              { _id: new ObjectId(item.productId) },
              {
                projection: {
                  productTitle: 1,
                  image: 1,
                  mainPrice: 1,
                  price: 1,
                  quantity: 1,
                },
              }
            );

            return {
              _id: product?._id,
              productTitle: product?.productTitle,
              image: product?.image,
              mainPrice: parseFloat(product?.mainPrice || 0),
              price: parseFloat(product?.price || 0),
              quantity: product?.quantity,
              stock: parseInt(product?.quantity || 0),
            };
          })
        );

        res.status(200).json({ wishList: wishListItemsWithDetails });
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Add item to cart
    app.post("/add-to-wish-list", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      // console.log(decodedEmail);
      const { email, productId, quantity, checked } = req.body;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauathorized access from this email" });
      }

      try {
        let wishList = await wishListCollection.findOne({ email });

        if (!wishList) {
          wishList = { email, wishList: [] };
        }

        console.log(productId, "wishId");
        console.log(wishList, "wish");

        const existingItemIndex = wishList.wishList.findIndex(
          (item) => item.productId.toString() === productId
        );
        if (existingItemIndex !== -1) {
          wishList.wishList[existingItemIndex].quantity += quantity;
        } else {
          wishList.wishList.push({ productId, quantity, checked });
        }

        await wishListCollection.updateOne(
          { email },
          { $set: wishList },
          { upsert: true }
        );

        // ...
        // After updating the cart in the database
        const updatedWishList = wishList.wishList; // Assuming `cart.cart` contains the updated cart data
        res.status(200).json({ wishList: updatedWishList });

        // res.status(201).json(cart);
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    });

    app.delete("/remove-from-wish-list/:id", async (req, res) => {
      const productId = req.params.id; // Use projectId instead of id
      console.log(productId);
      const query = { projectId: productId }; // Use projectId field name
      console.log(query);
      try {
        const result = await wishListCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Item deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Item not found" });
        }
      } catch (error) {
        console.error("Error deleting item:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

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
      const decodedEmail = req.data?.email;
      const email = req.query.email;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauthorized access from this email" });
      }

      try {
        let cart = await cartCollection.findOne({ email });
        if (!cart) {
          cart = { cart: [] };
        }
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
                  quantity: 1,
                },
              }
            );

            // Determine the updated quantity
            const updatedQuantity =
              parseInt(product?.quantity || 0) < item?.quantity
                ? parseInt(product?.quantity || 0)
                : item?.quantity;

            // Determine the updated checked value
            const updatedChecked =
              parseInt(product?.quantity || 0) > 0 ? item?.checked : false;

            await cartCollection.updateOne(
              { email, "cart.productId": item.productId },
              {
                $set: {
                  "cart.$.quantity": updatedQuantity,
                  "cart.$.checked": updatedChecked,
                },
              }
            );

            return {
              _id: product?._id,
              productTitle: product?.productTitle,
              image: product?.image,
              mainPrice: parseFloat(product?.mainPrice || 0),
              price: parseFloat(product?.price || 0),
              quantity: updatedQuantity,
              stock: parseInt(product?.quantity || 0),
              checked: updatedChecked,
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
      const decodedEmail = req.data?.email;
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

        console.log(productId, "Productid");
        console.log(cart, "cart-cart");

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

        // ...
        // After updating the cart in the database
        const updatedCart = cart.cart; // Assuming `cart.cart` contains the updated cart data
        res.status(200).json({ cart: updatedCart });

        // res.status(201).json(cart);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Update cart product with new quantity and checked status
    app.put("/update-cart-product/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
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

        const decodedEmail = req.data?.email;

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

    // ______________checkout  ______________

    //get all the selected orders
    const getcartDataWithProductDetail_CHECKED = async (email) => {
      try {
        const cart = await cartCollection.findOne({ email });

        const checkedItems = cart.cart.filter((item) => item?.checked); //only checked
        const cartItemsWithDetails = await Promise.all(
          checkedItems.map(async (item) => {
            if (item?.checked) {
              const product = await productsCollection.findOne(
                { _id: new ObjectId(item.productId) },
                {
                  projection: {
                    productTitle: 1,
                    image: 1,
                    mainPrice: 1,
                    price: 1,
                    quantity: 1,
                  },
                }
              );

              // Determine the updated quantity
              const updatedQuantity =
                parseInt(product?.quantity || 0) < item?.quantity
                  ? parseInt(product?.quantity || 0)
                  : item?.quantity;

              // Determine the updated checked value
              const updatedChecked =
                parseInt(product?.quantity || 0) > 0 ? item?.checked : false;

              await cartCollection.updateOne(
                { email, "cart.productId": item.productId },
                {
                  $set: {
                    "cart.$.quantity": updatedQuantity,
                    "cart.$.checked": updatedChecked,
                  },
                }
              );

              return {
                _id: product?._id.toHexString(),
                productId: product?._id.toHexString(),
                productTitle: product?.productTitle,
                image: product?.image,
                mainPrice: parseFloat(product?.mainPrice || 0),
                price: parseFloat(product?.price || 0),
                quantity: updatedQuantity,
                stock: parseInt(product?.quantity || 0),
                checked: updatedChecked,
              };
            }
          })
        );
        return cartItemsWithDetails.filter((i) => i.stock > 0);
      } catch (error) {
        return [];
      }
    };

    const sumOfTotalProductPrice_Checked = async (data) => {
      // console.log(data)
      let total = 0;
      if (data) {
        total = data.reduce(
          (sum, product) => product?.price * product?.quantity + sum,
          0
        );
        return Math.ceil(total);
      } else {
        return false;
      }
    };

    //User city default delivery charge
    const getDeliveryCharge_ofSingleUser = async (email) => {
      const user = await profileCollection.findOne({ email: email });
      if (user) {
        const deiveryCharge = await deliveryChargeCollection.findOne({
          name: user?.city,
        });
        return deiveryCharge;
      } else {
        return false;
      }
    };

    //Discounted delivery charge by comparing ordered total amount and default delivery charge from getDeliveryCharge_ofSingleUser()
    const getCourierCharge = async (deliveryCharge, totalPriceOfProduct) => {
      let courirerCharge = 10000;
      if (totalPriceOfProduct >= deliveryCharge?.minimumOrderLimit) {
        courirerCharge = deliveryCharge?.DiscountedDeliveryCharge;
      } else {
        courirerCharge = deliveryCharge?.DefaultdeliveryCharge;
      }
      return courirerCharge;
    };

    app.get("/checkout", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauthorized access from this email" });
      }

      const CheckkedProdcuts_DataWithProductDetail =
        await getcartDataWithProductDetail_CHECKED(email);
      const total = await sumOfTotalProductPrice_Checked(
        CheckkedProdcuts_DataWithProductDetail
      );
      let deliveryCharge = await getDeliveryCharge_ofSingleUser(email);
      if (deliveryCharge) {
        const courirerCharge = await getCourierCharge(deliveryCharge, total);
        res.status(200).send({
          cart: CheckkedProdcuts_DataWithProductDetail,
          deliveryCharge: courirerCharge,
          totalProductPrice: total,
        });
      } else {
        res.status(500).send({ msg: "delivery charge data not found" });
      }
    });

    // //place order
    app.post("/checkout", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;
      const { couponName } = req.body;
      try {
        if (decodedEmail !== email) {
          res
            .status(401)
            .send({ message: "unauthorized access from this email" });
          return;
        }

        //get user profile
        const userProfile = await profileCollection.findOne({ email: email });

        const CheckkedProdcuts_DataWithProductDetail =
          await getcartDataWithProductDetail_CHECKED(email);
        const total = await sumOfTotalProductPrice_Checked(
          CheckkedProdcuts_DataWithProductDetail
        );

        //DELIVERY CHARGE
        let defaultDeliveryCharge = await getDeliveryCharge_ofSingleUser(email);
        const courirerCharge = await getCourierCharge(
          defaultDeliveryCharge,
          total
        );

        const discountedData = {
          discountedAmmount: 0.0,
          couponCode: "N/A",
          status: 500,
        };

        if (couponName) {
          if (couponName === "coin") {
            const data = await calculateDiscountByCoin(
              total + courirerCharge,
              email,
              res
            );
            discountedData.couponCode = data?.couponCode;
            discountedData.discountedAmmount = data?.discountedAmmount;
            profileCollection.updateOne(
              { _id: userProfile?._id },
              { $inc: { coin: -data?.discountedAmmount } },
              { upsert: true }
            );
          } else {
            const { status, data } = await calculateDiscountByCoupon(
              couponName,
              email,
              res
            );
            if (status === 200) {
              discountedData.couponCode = data?.couponCode;
              discountedData.discountedAmmount = data?.discountedAmmount;
              discountedData.status = status;
            }
          }
        }

        const tempProducts = CheckkedProdcuts_DataWithProductDetail.map((i) => {
          return {
            productId: i?.productId,
            productName: i?.productTitle,
            productPrice: i?.price,
            productQuantity: i?.quantity,
            productImage: i?.image,
          };
        });

        const insertionData = {
          userId: userProfile?._id,
          userAddress: userProfile?.address,
          userCity: userProfile?.city,
          userPhone: userProfile?.phone,
          coupon: discountedData?.couponCode,
          subTotalAmount: total,
          discountedAmount: discountedData?.discountedAmmount,
          courirerCharge: courirerCharge,
          finalAmount: Math.ceil(
            total + courirerCharge - discountedData?.discountedAmmount
          ),
          orderStatus: [
            {
              name: "Payment Pending",
              message: "N/A",
              time: new Date().toISOString(),
            },
          ],
          orderedItems: tempProducts,
        };

        //insert order data
        const newOrder = await ordersCollection.insertOne(insertionData);

        console.log("New Order:", newOrder);

        //add coupon to profile
        if (discountedData?.status === 200) {
          if (userProfile?.coupon && Array.isArray(userProfile?.coupon)) {
            userProfile?.coupon.push(discountedData?.couponCode);
          } else {
            userProfile.coupon = [discountedData?.couponCode];
          }
          await profileCollection.updateOne(
            { email: email },
            { $set: { coupon: userProfile.coupon } }
          );
        }

        //subtract from stock
        if (newOrder?.insertedId && newOrder?.acknowledged) {
          await updateProductQuantitiesByOrder(
            newOrder?.insertedId,
            "subtract"
          );
        }

        //clean the cart
        const productsToRemove = CheckkedProdcuts_DataWithProductDetail.map(
          (i) => i?.productId
        );
        await cartCollection.updateOne(
          { email: email },
          { $pull: { cart: { productId: { $in: productsToRemove } } } }
        );

        return res.status(200).send({ orderData: newOrder });
      } catch (error) {
        console.error(error);
        return res.status(500).send({ msg: "error" });
      }
    });

    app.patch("/payment/:orderId", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;
      const { orderId } = req.params;
      // const data = req.body;
      try {
        if (decodedEmail !== email) {
          res
            .status(401)
            .send({ message: "unauthorized access from this email" });
          return;
        }
        const newStatus = {
          name: "Processing",
          message: `Payment has been confirmed through ${req.body?.typeOfPayment}`,
          time: new Date().toISOString(),
        };
        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(orderId) },
          { $set: req.body, $push: { orderStatus: newStatus } }
        );

        res.status(200).send({ orderData: result });
      } catch {
        res.status(500).send({ message: "internal server error!" });
      }
    });

    // ...

    // ...

    // ...

    // app.post("/checkout", verifyJWT, async (req, res) => {
    //   const decodedEmail = req.data;
    //   const email = req.query.email;
    //   const { couponName, orderType } = req.body;
    //   try {
    //     if (decodedEmail !== email) {
    //       res.status(401).send({ message: "unauthorized access from this email" });
    //       return;
    //     }

    //     // Get user profile
    //     const userProfile = await profileCollection.findOne({ email: email });

    //     const CheckkedProdcuts_DataWithProductDetail = await getcartDataWithProductDetail_CHECKED(
    //       email
    //     );
    //     const total = await sumOfTotalProductPrice_Checked(
    //       CheckkedProdcuts_DataWithProductDetail
    //     );

    //     const discountedData = { discountedAmmount: 0.0, couponCode: "N/A", status: 500 };

    //     if (couponName) {
    //       const { status, data } = await calculateDiscountByCoupon(couponName, email);
    //       if (status === 200) {
    //         discountedData.couponCode = data?.couponCode;
    //         discountedData.discountedAmmount = data?.discountedAmmount;
    //         discountedData.status = status;
    //       }
    //     }

    //     // DELIVERY CHARGE
    //     let defaultDeliveryCharge = await getDeliveryCharge_ofSingleUser(email);
    //     const courirerCharge = await getCourierCharge(defaultDeliveryCharge, total);

    //     const tempProducts = CheckkedProdcuts_DataWithProductDetail.map((i) => {
    //       return {
    //         productId: i?.productId,
    //         productName: i?.productTitle,
    //         productPrice: i?.price,
    //         productQuantity: i?.quantity,
    //       };
    //     });

    //     // Check if an order with the same user and status "Payment Pending" exists
    //     const existingOrder = await ordersCollection.findOne({
    //       userId: userProfile?._id,
    //       "orderStatus.name": "Payment Pending",
    //     });

    //     if (existingOrder) {
    //       // Update the existing order's orderType
    //       await ordersCollection.updateOne(
    //         { _id: existingOrder._id },
    //         { $set: { orderType: orderType } }
    //       );

    //       return res.status(200).send({ orderData: existingOrder });
    //     } else {
    //       // Create a new order
    //       const insertionData = {
    //         userId: userProfile?._id,
    //         userAddress: userProfile?.address,
    //         userCity: userProfile?.city,
    //         userPhone: userProfile?.phone,
    //         coupon: discountedData?.couponCode,
    //         subTotalAmount: total,
    //         discountedAmount: discountedData?.discountedAmmount,
    //         courirerCharge: courirerCharge,
    //         finalAmount: Math.ceil(
    //           total + courirerCharge - discountedData?.discountedAmmount
    //         ),
    //         orderStatus: [
    //           { name: "Payment Pending", message: "N/A", time: new Date().toISOString() },
    //         ],
    //         orderedItems: tempProducts,
    //         orderType: orderType, // Add orderType here
    //       };

    //       const newOrder = await ordersCollection.insertOne(insertionData);

    //       console.log("New Order:", newOrder);

    //       // Add coupon to profile
    //       if (discountedData?.status === 200) {
    //         if (userProfile?.coupon && Array.isArray(userProfile?.coupon)) {
    //           userProfile?.coupon.push(discountedData?.couponCode);
    //         } else {
    //           userProfile.coupon = [discountedData?.couponCode];
    //         }
    //         await profileCollection.updateOne(
    //           { email: email },
    //           { $set: { coupon: userProfile.coupon } }
    //         );
    //       }

    //       // Clean the cart
    //       const productsToRemove = CheckkedProdcuts_DataWithProductDetail.map((i) => i?.productId);
    //       // await cartCollection.updateOne({ email: email },
    //       //   { $pull: { cart: { productId: { $in: productsToRemove } } } })

    //       return res.status(200).send({ orderData: newOrder });
    //     }
    //   } catch (error) {
    //     console.error(error);
    //     return res.status(500).send({ msg: "error" });
    //   }
    // });

    // Update orderType and transactionId for an existing order
    app.put("/updateOrder/:orderId", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;
      const orderId = req.params.orderId;
      console.log(orderId);
      const { orderType, transactionId } = req.body;
      console.log(orderType, transactionId);

      try {
        if (decodedEmail !== email) {
          res
            .status(401)
            .send({ message: "Unauthorized access from this email" });
          return;
        }

        // Check if the order exists for the given orderId
        const existingOrder = await ordersCollection.findOne({ _id: orderId });
        console.log(existingOrder);

        if (!existingOrder) {
          res.status(404).send({ message: "Order not found" });
          return;
        }

        // Ensure that the order belongs to the authorized user
        if (existingOrder.userId !== decodedEmail) {
          res
            .status(401)
            .send({ message: "Unauthorized access to this order" });
          return;
        }

        // Update the existing order with orderType and transactionId
        const updateResult = await ordersCollection.updateOne(
          { _id: orderId },
          { $set: { orderType: orderType, transactionId: transactionId } }
        );

        console.log(updateResult);

        if (updateResult.modifiedCount === 0) {
          res.status(400).send({ message: "Order update failed" });
          return;
        }

        res.status(200).send({ message: "Order updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ msg: "Error" });
      }
    });

    // Define a route to get all orders
    app.get("/orders", verifyJWT, async (req, res) => {
      try {
        // Query the ordersCollection to retrieve all orders
        const allOrders = await ordersCollection.find({}).toArray();

        // Return the list of orders in the response
        return res.status(200).send({ orders: allOrders });
      } catch (error) {
        console.error(error);
        return res.status(500).send({ msg: "Error retrieving orders" });
      }
    });

    // ________________ PAYMENT For ORDER ___________________

    app.get("/payment-methods", verifyJWT, async (req, res) => {
      try {
        const _orderID = req.query._orderID;
        const email = req.query.email;
        const decodedEmail = req.data?.email;
        if (decodedEmail !== email) {
          res.status(409).send({ message: "unauthorized" });
          return;
        }
        const orderData = await ordersCollection.findOne({
          _id: new ObjectId(_orderID),
        });
        console.log(orderData);
        if (orderData) {
          if (orderData?.typeOfPayment) {
            res.status(403).send({
              message:
                "Payment has already been made. You cannot modify the order.",
            });
            return;
          } else {
            res.status(200).send({
              productLength: orderData?.orderedItems.length,
              totalAmount: orderData?.finalAmount,
            });
          }
        } else {
          res.status(404).send({ message: "not found" });
        }
      } catch {
        (e) => {
          res.status(500).send({ message: "error in server" });
        };
      }
    });

    // ___________________coupon _________________________

    const isDateInRange = async (startDateString, endDateString) => {
      const currentDate = new Date();
      const startDate = new Date(startDateString);
      const endDate = new Date(endDateString);

      return currentDate >= startDate && currentDate <= endDate;
    };

    const applicable_Or_Not_Coupon_ForMultipleUse = async (
      couponData,
      userCouponData,
      couponName
    ) => {
      const numberOf_Use_OfThatCoupon = userCouponData.filter(
        (i) => i === couponName
      );
      if (numberOf_Use_OfThatCoupon.length >= couponData?.numberOfUse) {
        return false;
      } else {
        return true;
      }
    };

    const CalculateDiscount = async (email, couponData) => {
      let discountedAmmount = 0;
      const CheckkedProdcuts_DataWithProductDetail =
        await getcartDataWithProductDetail_CHECKED(email);
      const total = await sumOfTotalProductPrice_Checked(
        CheckkedProdcuts_DataWithProductDetail
      );
      discountedAmmount = total * (parseFloat(couponData?.percentage) / 100);
      // console.log(couponData?.percentage, " ", total, " ");
      if (discountedAmmount > couponData?.maximumDiscountLimit) {
        discountedAmmount = couponData?.maximumDiscountLimit;
      }
      return Math.floor(discountedAmmount);
    };

    const calculateDiscountByCoupon = async (couponName, email, res) => {
      const couponData = await couponsCollection.findOne({
        couponCode: couponName,
      });

      if (!couponData) {
        res.status(404).send({ message: "No coupon by this name" });
      } else {
        const user = await profileCollection.findOne(
          { email: email },
          { projection: { _id: 0, coupon: 1 } }
        );

        if (!user) {
          res.status(404).send({ message: "No user by this name" });
          return;
        }

        let userCouponData = [];

        if (user?.coupon) {
          userCouponData = user?.coupon;
        }

        const isValidCouponByTime = await isDateInRange(
          couponData?.start_Date,
          couponData?.end_Date
        );
        const applicable_forMultipleUse =
          await applicable_Or_Not_Coupon_ForMultipleUse(
            couponData,
            userCouponData,
            couponName
          );

        if (!isValidCouponByTime || !applicable_forMultipleUse) {
          let msg = "";

          if (!applicable_forMultipleUse) {
            msg = "Maximum time used";
          }
          if (!isValidCouponByTime) {
            msg = "Campaign Time Over";
          }
          return { status: 403, data: { message: msg } };
        }

        if (isValidCouponByTime && applicable_forMultipleUse) {
          const discountedAmmount = await CalculateDiscount(email, couponData);
          const responseData = {
            couponCode: couponData?.couponCode,
            discountedAmmount: discountedAmmount,
          };
          // console.log(responseData)

          return { status: 200, data: responseData };
        }
      }
    };

    app.post("/get-discount-by-coupon", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;

      const { couponName } = req.body;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauthorized access from this email" });
      }

      const responseData = await calculateDiscountByCoupon(
        couponName,
        email,
        res
      );
      res.status(responseData?.status).send(responseData?.data);
    });

    const calculateDiscountByCoin = async (finalAmount, email, res) => {
      const user = await profileCollection.findOne(
        { email: email },
        { projection: { _id: 1, coin: 1 } }
      );

      if (!user) {
        res.status(404).send({ message: "No user by this name" });
        return;
      }

      const responseData = {
        couponCode: "N/A",
        discountedAmmount: 0,
        message: "Coin amount less than 100",
      };
      if (user?.coin >= 100) {
        responseData.couponCode = "coin";
        responseData.discountedAmmount =
          user?.coin > finalAmount ? finalAmount : user?.coin;
        responseData.message = "Yay you got discount";
        responseData.success = true;
      }

      // console.log(responseData)

      return responseData;
    };

    app.post("/get-discount-by-coin", verifyJWT, async (req, res) => {
      const decodedEmail = req.data?.email;
      const email = req.query.email;

      if (decodedEmail !== email) {
        res
          .status(401)
          .send({ message: "unauthorized access from this email" });
      }

      const { finalAmount } = req.body;

      const responseData = await calculateDiscountByCoin(
        finalAmount,
        email,
        res
      );
      res.status(200).send(responseData);
    });

    //--------------------------------Payment Intent--------------------------------

    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      console.log(1, price);
      const amount = parseInt(price * 100);
      //console.log(2, amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      console.log(3, paymentIntent);

      res.send({
        clientSecret: paymentIntent.client_secret,
      });

      console.log(4, paymentIntent.client_secret);
    });

    app.get("/get-payments", verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.status(401).send([]);
      }
      const decodedEmail = req.data?.email;
      console.log(req.data);
      console.log(5, decodedEmail);
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "unauthorized" });
      }
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      // const query = { productId: payment.payItems };
      // console.log(query, "QU");
      // const deleteResult = await cartCollection.deleteMany(query);
      // console.log(deleteResult);

      res.send({ insertResult });
    });

    app.get(
      "/orders/current",
      verifyJWT,
      checkPermission(["admin", "Order Manager", "Delivery Partner"]),
      async (req, res) => {
        const query = req.query?.q;
        const role = req.query?.role;
        const email = req.query?.email;
        const size = parseInt(req.query.size);
        const currentPage = parseInt(req.query.currentPage);
        //console.log(query, size, currentPage)
        let count = 0;
        let result = [];
        if (query) {
          if (role === "Delivery Partner") {
            result = await ordersCollection
              .find({
                $and: [
                  {
                    $or: [
                      { userPhone: { $regex: query, $options: "i" } },
                      { "deliveryPartner.email": email },
                    ],
                  },
                  {
                    $or: [
                      { status: { $ne: "Delivered" } },
                      { status: { $ne: "Cancelled" } },
                      {
                        $and: [
                          { deliveryPartner: { $exists: true } },
                          { "orderStatus.name": "Shipped" },
                        ],
                      },
                    ],
                  },
                ],
              })
              .sort({ _id: -1 })
              .skip(currentPage * size)
              .limit(size)
              .project({
                _id: 1,
                userId: 1,
                userCity: 1,
                userPhone: 1,
                coupon: 1,
                subTotalAmount: 1,
                discountedAmount: 1,
                courirerCharge: 1,
                finalAmount: 1,
                orderStatus: 1,
                typeOfPayment: 1,
                deliveryPartner: 1,
                userAddress: 1,
                status: 1,
              })
              .toArray();

            count = await ordersCollection.countDocuments({
              $and: [
                {
                  $or: [
                    { userPhone: { $regex: query, $options: "i" } },
                    { "deliveryPartner.email": email },
                  ],
                },
                {
                  $or: [
                    { status: { $ne: "Delivered" } },
                    { status: { $ne: "Cancelled" } },
                    {
                      $and: [
                        { deliveryPartner: { $exists: true } },
                        { "orderStatus.name": "Shipped" },
                      ],
                    },
                  ],
                },
              ],
            });
          } else {
            result = await ordersCollection
              .find({
                $and: [
                  {
                    $or: [{ userPhone: { $regex: query, $options: "i" } }],
                  },
                  {
                    status: {
                      $nin: ["Delivered", "Cancelled"],
                    },
                  },
                ],
              })
              .sort({ _id: -1 })
              .skip(currentPage * size)
              .limit(size)
              .project({
                _id: 1,
                userId: 1,
                userCity: 1,
                userPhone: 1,
                coupon: 1,
                subTotalAmount: 1,
                discountedAmount: 1,
                courirerCharge: 1,
                finalAmount: 1,
                orderStatus: 1,
                typeOfPayment: 1,
                deliveryPartner: 1,
                userAddress: 1,
                status: 1,
              })
              .toArray();

            count = await ordersCollection.countDocuments({
              $and: [
                {
                  $or: [{ userPhone: { $regex: query, $options: "i" } }],
                },
                {
                  status: {
                    $nin: ["Delivered", "Cancelled"],
                  },
                },
              ],
            });
          }

          return res.send({ orders: result, count: count });
        }
        // Count query
        if (role === "Delivery Partner") {
          count = await ordersCollection.countDocuments({
            $and: [
              {
                "deliveryPartner.email": email,
              },
              {
                status: {
                  $nin: ["Delivered", "Cancelled"],
                },
              },
              {
                deliveryPartner: { $exists: true },
              },
            ],
          });

          // Find query
          result = await ordersCollection
            .find({
              $and: [
                {
                  "deliveryPartner.email": email,
                },
                {
                  status: {
                    $nin: ["Delivered", "Cancelled"],
                  },
                },
                {
                  deliveryPartner: { $exists: true },
                },
              ],
            })
            .sort({ _id: -1 })
            .skip(currentPage * size)
            .limit(size)
            .toArray();
        } else {
          count = await ordersCollection.countDocuments({
            $and: [
              {
                status: {
                  $nin: ["Delivered", "Cancelled"],
                },
              },
            ],
          });

          // Find query
          result = await ordersCollection
            .find({
              $and: [
                {
                  status: {
                    $nin: ["Delivered", "Cancelled"],
                  },
                },
              ],
            })
            .sort({ _id: -1 })
            .skip(currentPage * size)
            .limit(size)
            .toArray();
        }

        //console.log(result);
        res.send({ orders: result, count: count });
      }
    );
    app.get(
      "/orders/delivered",
      verifyJWT,

      async (req, res) => {
        const query = req.query?.q;
        const size = parseInt(req.query.size);
        const role = req.query?.role;
        const email = req.query?.email;
        const currentPage = parseInt(req.query.currentPage);
        //console.log(query, size, currentPage)
        let count = 0;

        let result = [];
        if (query) {
          if (role === "Delivery Partner") {
            result = await ordersCollection
              .find({
                $and: [
                  {
                    $or: [
                      { userPhone: { $regex: query, $options: "i" } },
                      { "deliveryPartner.email": email },
                    ],
                  },
                  {
                    $or: [
                      { status: { $eq: "Delivered" } },

                      {
                        $and: [
                          { deliveryPartner: { $exists: true } },
                          { "orderStatus.name": "Shipped" },
                        ],
                      },
                    ],
                  },
                ],
              })
              .sort({ _id: -1 })
              .skip(currentPage * size)
              .limit(size)
              .project({
                _id: 1,
                userId: 1,
                userCity: 1,
                userPhone: 1,
                coupon: 1,
                subTotalAmount: 1,
                discountedAmount: 1,
                courirerCharge: 1,
                finalAmount: 1,
                orderStatus: 1,
                typeOfPayment: 1,
                deliveryPartner: 1,
                userAddress: 1,
                status: 1,
              })
              .toArray();

            count = await ordersCollection.countDocuments({
              $and: [
                {
                  $or: [
                    { userPhone: { $regex: query, $options: "i" } },
                    { "deliveryPartner.email": email },
                  ],
                },
                {
                  $or: [
                    { status: { $eq: "Delivered" } },

                    {
                      $and: [
                        { deliveryPartner: { $exists: true } },
                        { "orderStatus.name": "Shipped" },
                      ],
                    },
                  ],
                },
              ],
            });
          } else {
            result = await ordersCollection
              .find({
                $and: [
                  {
                    $or: [{ userPhone: { $regex: query, $options: "i" } }],
                  },
                  {
                    status: "Delivered",
                  },
                ],
              })
              .sort({ _id: -1 })
              .skip(currentPage * size)
              .limit(size)
              .project({
                _id: 1,
                userId: 1,
                userCity: 1,
                userPhone: 1,
                coupon: 1,
                subTotalAmount: 1,
                discountedAmount: 1,
                courirerCharge: 1,
                finalAmount: 1,
                orderStatus: 1,
                typeOfPayment: 1,
                deliveryPartner: 1,
                userAddress: 1,
                status: 1,
              })
              .toArray();

            count = await ordersCollection.countDocuments({
              $and: [
                {
                  $or: [{ userPhone: { $regex: query, $options: "i" } }],
                },
                {
                  status: "Delivered",
                },
              ],
            });
          }

          return res.send({ orders: result, count: count });
        }
        // Count query
        if (role === "Delivery Partner") {
          count = await ordersCollection.countDocuments({
            $and: [
              {
                "deliveryPartner.email": email,
              },
              {
                status: "Delivered",
              },
              {
                deliveryPartner: { $exists: true },
              },
            ],
          });

          // Find query
          result = await ordersCollection
            .find({
              $and: [
                {
                  "deliveryPartner.email": email,
                },
                {
                  status: "Delivered",
                },
                {
                  deliveryPartner: { $exists: true },
                },
              ],
            })
            .sort({ _id: -1 })
            .skip(currentPage * size)
            .limit(size)
            .toArray();
        } else {
          count = await ordersCollection.countDocuments({
            $and: [
              {
                status: "Delivered",
              },
            ],
          });

          // Find query
          result = await ordersCollection
            .find({
              $and: [
                {
                  status: "Delivered",
                },
              ],
            })
            .sort({ _id: -1 })
            .skip(currentPage * size)
            .limit(size)
            .toArray();
        }

        //console.log(result);
        res.send({ orders: result, count: count });
      }
    );
    app.get(
      "/orders/canceled",
      verifyJWT,
      checkPermission(["admin", "Order Manager", "Delivery Partner"]),
      async (req, res) => {
        const query = req.query?.q;
        const size = parseInt(req.query.size);
        const role = req.query?.role;
        const email = req.query?.email;
        const currentPage = parseInt(req.query.currentPage);
        //console.log(query, size, currentPage)
        let count = 0;

        let result = [];
        if (query) {
          if (role === "Delivery Partner") {
            result = await ordersCollection
              .find({
                $and: [
                  {
                    $or: [
                      { userPhone: { $regex: query, $options: "i" } },
                      { "deliveryPartner.email": email },
                    ],
                  },
                  {
                    $or: [
                      { status: { $eq: "Cancelled" } },

                      {
                        $and: [
                          { deliveryPartner: { $exists: true } },
                          { "orderStatus.name": "Shipped" },
                        ],
                      },
                    ],
                  },
                ],
              })
              .sort({ _id: -1 })
              .skip(currentPage * size)
              .limit(size)
              .project({
                _id: 1,
                userId: 1,
                userCity: 1,
                userPhone: 1,
                coupon: 1,
                subTotalAmount: 1,
                discountedAmount: 1,
                courirerCharge: 1,
                finalAmount: 1,
                orderStatus: 1,
                typeOfPayment: 1,
                deliveryPartner: 1,
                userAddress: 1,
                status: 1,
              })
              .toArray();

            count = await ordersCollection.countDocuments({
              $and: [
                {
                  $or: [
                    { userPhone: { $regex: query, $options: "i" } },
                    { "deliveryPartner.email": email },
                  ],
                },
                {
                  $or: [
                    { status: { $eq: "Cancelled" } },

                    {
                      $and: [
                        { deliveryPartner: { $exists: true } },
                        { "orderStatus.name": "Shipped" },
                      ],
                    },
                  ],
                },
              ],
            });
          } else {
            result = await ordersCollection
              .find({
                $and: [
                  {
                    $or: [{ userPhone: { $regex: query, $options: "i" } }],
                  },
                  {
                    status: "Cancelled",
                  },
                ],
              })
              .sort({ _id: -1 })
              .skip(currentPage * size)
              .limit(size)
              .project({
                _id: 1,
                userId: 1,
                userCity: 1,
                userPhone: 1,
                coupon: 1,
                subTotalAmount: 1,
                discountedAmount: 1,
                courirerCharge: 1,
                finalAmount: 1,
                orderStatus: 1,
                typeOfPayment: 1,
                deliveryPartner: 1,
                userAddress: 1,
                status: 1,
              })
              .toArray();

            count = await ordersCollection.countDocuments({
              $and: [
                {
                  $or: [{ userPhone: { $regex: query, $options: "i" } }],
                },
                {
                  status: "Cancelled",
                },
              ],
            });
          }

          return res.send({ orders: result, count: count });
        }
        // Count query
        if (role === "Delivery Partner") {
          count = await ordersCollection.countDocuments({
            $and: [
              {
                "deliveryPartner.email": email,
              },
              {
                status: "Cancelled",
              },
              {
                deliveryPartner: { $exists: true },
              },
            ],
          });

          // Find query
          result = await ordersCollection
            .find({
              $and: [
                {
                  "deliveryPartner.email": email,
                },
                {
                  status: "Cancelled",
                },
                {
                  deliveryPartner: { $exists: true },
                },
              ],
            })
            .sort({ _id: -1 })
            .skip(currentPage * size)
            .limit(size)
            .toArray();
        } else {
          count = await ordersCollection.countDocuments({
            $and: [
              {
                status: "Cancelled",
              },
            ],
          });

          // Find query
          result = await ordersCollection
            .find({
              $and: [
                {
                  status: "Cancelled",
                },
              ],
            })
            .sort({ _id: -1 })
            .skip(currentPage * size)
            .limit(size)
            .toArray();
        }

        //console.log(result);
        res.send({ orders: result, count: count });
      }
    );
    // app.get(
    //   "/orders/canceled",
    //   verifyJWT,
    //   checkPermission(["admin", "Order Manager", "Delivery Partner"]),
    //   async (req, res) => {
    //     const query = req.query?.q;
    //     const size = parseInt(req.query.size);
    //     const currentPage = parseInt(req.query.currentPage);
    //     //console.log(query, size, currentPage)
    //     let count = 0;
    //     if (query) {
    //     }
    //     let result = [];
    //     if (query) {
    //       result = await ordersCollection
    //         .find({
    //           $and: [
    //             {
    //               $or: [{ userPhone: { $regex: query, $options: "i" } }],
    //             },
    //             {
    //               status: "Cancelled",
    //             },
    //           ],
    //         })
    //         .sort({ _id: -1 })
    //         .skip(currentPage * size)
    //         .limit(size)
    //         .project({
    //           _id: 1,
    //           userId: 1,
    //           userCity: 1,
    //           userPhone: 1,
    //           coupon: 1,
    //           subTotalAmount: 1,
    //           discountedAmount: 1,
    //           courirerCharge: 1,
    //           finalAmount: 1,
    //           orderStatus: 1,
    //           typeOfPayment: 1,
    //           deliveryPartner: 1,
    //           userAddress: 1,
    //           status: 1,
    //         })
    //         .toArray();

    //       count = await ordersCollection.countDocuments({
    //         $and: [
    //           {
    //             $or: [{ userPhone: { $regex: query, $options: "i" } }],
    //           },
    //           {
    //             status: "Cancelled",
    //           },
    //         ],
    //       });

    //       return res.send({ orders: result, count: count });
    //     }
    //     // Count query
    //     count = await ordersCollection.countDocuments({
    //       $and: [
    //         {
    //           status: "Cancelled",
    //         },
    //       ],
    //     });

    //     // Find query
    //     result = await ordersCollection
    //       .find({
    //         $and: [
    //           {
    //             status: "Cancelled",
    //           },
    //         ],
    //       })
    //       .sort({ _id: -1 })
    //       .skip(currentPage * size)
    //       .limit(size)
    //       .toArray();

    //     //console.log(result);
    //     res.send({ orders: result, count: count });
    //   }
    // );

    app.get(
      "/get-all-user-profile",
      verifyJWT,
      checkPermission(["admin"]),
      async (req, res) => {
        const result = await profileCollection.find().toArray();
        console.log(result);
        res.send(result);
      }
    );

    app.delete(
      "/products/:id",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await productsCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.delete(
      "/categories/:id",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await categoryCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.delete(
      "/sub-categories/:id",
      verifyJWT,
      checkPermission(["admin", "Product Manager"]),
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await subCategoryCollection.deleteOne(query);
        res.send(result);
      }
    );

    // app.delete("/categories/:topRightBannerLayout2", verifyJWT, checkPermission(['admin', 'Product Manager']), async (req, res) => {
    //   const topRightBannerLayout2 = req.query.topRightBannerLayout2;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await categoryCollection.deleteOne(query);
    //   res.send(result);
    // });

    //----------------------------------order detail-------------------------------------

    //user order detail get
    app.get("/order-details", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const _orderId = req.query._id;
      if (!email) {
        res.status(401).send([]);
      }
      const decodedEmail = req.data?.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "unauthorized" });
      }

      try {
        const result = await ordersCollection
          .find({ userId: new ObjectId(_orderId) })
          .sort({ _id: -1 })
          .limit(15)
          .project({
            _id: 1,
            userAddress: 1,
            userCity: 1,
            finalAmount: 1,
            status: 1,
            orderStatus: 1,
            transactionId: 1,
            typeOfPayment: 1,
          })
          .toArray();
        res.status(200).send({ allOrders: result });
      } catch {
        (e) => {
          res.status(500).send({ message: "error in server" });
        };
      }
    });

    ////order details view for user
    app.get("/order-detail-view/:_orderId", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const _orderId = req.params._orderId;
      //console.log(_orderId);
      if (!email) {
        res.status(401).send([]);
      }
      const decodedEmail = req.data?.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "unauthorized" });
      }

      try {
        const result = await ordersCollection.findOne({
          _id: new ObjectId(_orderId),
        });
        //console.log(result)
        res.status(200).send({ details: result });
      } catch {
        (e) => {
          res.status(500).send({ message: "error in server" });
        };
      }
    });

    ///order detail view for admin
    app.get(
      "/for-admin/order-detail-view/:_orderId",
      verifyJWT,
      checkPermission(["admin", "Order Manager", "Delivery Partner"]),
      async (req, res) => {
        const _orderId = req.params._orderId;
        const role = req.query?.role;
        const email = req.query?.email;
        console.log(_orderId);

        try {
          let result;
          if (role === "Delivery Partner") {
            result = await ordersCollection.findOne(
              {
                _id: new ObjectId(_orderId),
                "deliveryPartner.email": email, // Check for the specific email
                "orderStatus.name": "Shipped", // Ensure that orderStatus.name is "Shipped"
                deliveryPartner: { $exists: true }, // Ensure the existence of deliveryPartner
              },
              {
                projection: {
                  _id: 1,
                  userId: 1,
                  userCity: 1,
                  userPhone: 1,
                  coupon: 1,
                  orderedItems: 1,
                  subTotalAmount: 1,
                  discountedAmount: 1,
                  courirerCharge: 1,
                  finalAmount: 1,
                  orderStatus: 1,
                  typeOfPayment: 1,
                  deliveryPartner: 1,
                  userAddress: 1,
                  status: 1,
                },
              }
            );
            if (!result || !result?.deliveryPartner) {
              return res.status(404).send({ message: "No Data Found" });
            }
          } else {
            result = await ordersCollection.findOne(
              { _id: new ObjectId(_orderId) },
              {
                projection: {
                  _id: 1,
                  userId: 1,
                  userCity: 1,
                  userPhone: 1,
                  coupon: 1,
                  orderedItems: 1,
                  subTotalAmount: 1,
                  discountedAmount: 1,
                  courirerCharge: 1,
                  finalAmount: 1,
                  orderStatus: 1,
                  typeOfPayment: 1,
                  deliveryPartner: 1,
                  userAddress: 1,
                  status: 1,
                },
              }
            );

            if (!result) {
              return res.status(404).send({ message: "No Data Found" });
            }
          }

          const userName = await profileCollection.findOne(
            { _id: result?.userId },
            { projection: { name: 1 } }
          );
          result.name = userName?.name;
          res.status(200).send({ details: result });
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    // change order ammount total amount and discounted ammount
    app.patch(
      "/change-order-total-ammount",
      verifyJWT,
      checkPermission(["admin", "Order Manager"]),
      async (req, res) => {
        const id = req.body?.id;
        const finalAmount = req.body?.finalAmount;
        const discountedAmount = req.body?.discountedAmount;

        try {
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                finalAmount: finalAmount,
                discountedAmount: discountedAmount,
              },
            }
          );
          res.status(200).send({ orderData: result });
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    // subtract or add back  product quantity
    async function updateProductQuantitiesByOrder(orderId, type) {
      return new Promise(async (resolve, reject) => {
        try {
          // Find the order by _id
          const order = await ordersCollection.findOne(
            { _id: new ObjectId(orderId) },
            {
              projection: {
                _id: 1,
                orderedItems: 1,
              },
            }
          );

          if (!order) {
            console.error(`Order with _id ${orderId} not found.`);
            return reject(`Order with _id ${orderId} not found.`);
          }

          // Use Promise.all to update product quantities in parallel
          const updateQuantityPromises = order.orderedItems.map(
            async (item) => {
              const productId = item.productId;
              const orderedQuantity = item.productQuantity;

              // Fetch the product using the product ID
              const product = await productsCollection.findOne(
                { _id: new ObjectId(productId) },
                { projection: { _id: 1, quantity: 1 } }
              );

              if (!product) {
                console.error(`Product with ID ${productId} not found.`);
                return reject(`Product with ID ${productId} not found.`);
              }

              let newQuantity;

              if (type === "subtract") {
                newQuantity =
                  parseInt(product.quantity) - parseInt(orderedQuantity);
              } else if (type === "add") {
                newQuantity =
                  parseInt(product.quantity) + parseInt(orderedQuantity);
              }

              // Calculate the new quantity

              // Update the product data with the new quantity
              await productsCollection.updateOne(
                { _id: new ObjectId(productId) },
                { $set: { quantity: parseInt(newQuantity) } }
              );
            }
          );

          await Promise.all(updateQuantityPromises);
          resolve(); // Resolve the promise when all updates are complete
        } catch (error) {
          console.error("Error updating product quantities:", error);
          reject(error);
        }
      });
    }

    // duplicate remover
    async function deleteDuplicateProducts() {
      try {
        // Create an aggregation pipeline to identify and delete duplicates
        const pipeline = [
          {
            $group: {
              _id: {
                productTitle: "$productTitle",
              },
              count: { $sum: 1 },
              uniqueIds: { $addToSet: "$_id" },
            },
          },
          {
            $match: {
              count: { $gt: 1 }, // Find duplicates with count greater than 1
            },
          },
        ];

        // Execute the aggregation pipeline
        const duplicateProducts = await productsCollection
          .aggregate(pipeline)
          .toArray();

        // Delete duplicates by keeping one item for each unique combination
        const deletePromises = duplicateProducts.map(async (duplicate) => {
          const uniqueIds = duplicate.uniqueIds;
          const keepProductId = uniqueIds[0]; // Keep the first ID

          // Delete the duplicate items (except the first one)
          const deleteFilter = {
            _id: { $in: uniqueIds.slice(1).map((id) => new ObjectId(id)) },
          };

          await productsCollection.deleteMany(deleteFilter);

          console.log(
            `Deleted duplicates for: ${JSON.stringify(duplicate._id)}`
          );
        });

        await Promise.all(deletePromises);
        console.log("Duplicates deleted successfully.");
      } catch (error) {
        console.error("Error deleting duplicates:", error);
      }
    }

    /**
     * -------------------------------------------  Admin Status Change -------------------------------------------------------------------------------------------------------------------------------------------------------
     * ___________________________________________  ORDER STATUS CHANGE ______________________________________________________________________________________________________________________________________________________
     * _______________________________________________________________________________________________________________________________________________________________________________________________________________________
     * /status-processing-to-processed        --> Go   from  "Processing"---------------------------------------------->  "Processed And Ready to Ship"  --order manager
     * /status-back-to-processed              --> back from  "Processed And Ready to Ship"------------------------------> "Processing"
     * /status-processed-to-shipped           --> Go   from  "Processed And Ready to Ship"------------------------------> "Shipped"                      --order manager  --> add delivery man & subtract from stock  updateProductQuantitiesByOrder(orderid, "subtract or add")
     * /status-processed-to-ready-to-delivery --> Go   from  "Shipped" --------------------------------------------------> "Ready To Delivery"           -- delivery man  --> make otp
     * /status-to-delivered                   --> Go   from  "Ready To Delivery" ----------------------------------------> "Delivered"                   -- delivery man
     *
     * /cacnel-order/:_id                     --> cancel a order
     */

    app.patch(
      "/status-processing-to-processed",
      verifyJWT,
      checkPermission(["admin", "Order Manager"]),
      async (req, res) => {
        const orderId = req.body?.id;

        if (!orderId) {
          return res.status(404).send({ message: "Invalid Request!" });
        }
        try {
          const newStatus = {
            name: "Processed And Ready to Ship",
            message: `${req.body?.message}`,
            time: new Date().toISOString(),
          };
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $push: { orderStatus: newStatus } }
          );

          res.status(200).send({ orderData: result });
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    app.patch(
      "/status-back-to-processed",
      verifyJWT,
      checkPermission(["admin", "Order Manager"]),
      async (req, res) => {
        const orderId = req.body?.id;

        if (!orderId) {
          return res.status(404).send({ message: "Invalid Request!" });
        }
        try {
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $pull: { orderStatus: { name: "Processed And Ready to Ship" } } }
          );

          res.status(200).send(true);
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    // to get delivery partner name
    app.get(
      "/get-delivery-partner",
      verifyJWT,
      checkPermission(["admin", "Order Manager"]),
      async (req, res) => {
        try {
          const deliveryPartner = await userCollection
            .find({ role: "Delivery Partner" })
            .toArray();
          //console.log(result)
          res.status(200).send({ deliveryPartner: deliveryPartner });
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    app.patch(
      "/status-processed-to-shipped",
      verifyJWT,
      checkPermission(["admin", "Order Manager"]),
      async (req, res) => {
        const deliveryMan = req.body?.deliveryPartner;

        const orderId = req.body?.id;

        if (!orderId || !deliveryMan) {
          return res.status(404).send({ message: "Invalid Request!" });
        }
        try {
          const newStatus = {
            name: "Shipped",
            message: `${req.body?.message}`,
            time: new Date().toISOString(),
          };
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
              $set: { deliveryPartner: deliveryMan },
              $push: { orderStatus: newStatus },
            }
          );

          res.status(200).send({ orderData: result });
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    const generateOTP = () => {
      const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from(
        { length: 6 },
        () => characters[Math.floor(Math.random() * characters.length)]
      ).join("");
    };

    app.patch(
      "/status-processed-to-ready-to-delivery",
      verifyJWT,
      checkPermission(["admin", "Delivery Partner"]),
      async (req, res) => {
        const orderId = req.body?.id;

        if (!orderId) {
          return res.status(404).send({ message: "Invalid Request!" });
        }
        try {
          // Generate a new OTP
          const OTP = generateOTP();

          // Retrieve the order details from ordersCollection based on orderId
          const order = await ordersCollection.findOne({
            _id: new ObjectId(orderId),
          });

          // Get the userPhone and deliveryPartner name from the order document
          const userPhone = order?.userPhone;
          const deliveryPartnerName = order?.deliveryPartner?.name; // Assumes 'deliveryPartner' is an embedded document

          // Remove the "+88" prefix from userPhone if it exists
          const phone = userPhone.replace("+88", "");

          // Prepare the SMS parameters
          const greenwebsms = new URLSearchParams();
          greenwebsms.append("token", `${process.env.SMS_TOKEN}`);
          greenwebsms.append("to", `+88${phone}`); // Replace with the recipient's phone number
          greenwebsms.append(
            "message",
            `E-Mart থেকে আপনার অর্ডার আমাদের এজেন্ট ${deliveryPartnerName} আজ ডেলিভারি করবে। আপনার OTP হল ${OTP} ।`
          ); // Include the generated OTP in the message

          // Send the OTP via SMS
          const smsResponse = await axios.post(
            "http://api.greenweb.com.bd/api.php",
            greenwebsms
          );
          console.log(smsResponse.data); // Log the response from the SMS API

          const newStatus = {
            name: "Ready To Delivery",
            message: `${req.body?.message}`,
            time: new Date().toISOString(),
          };

          // Update the order with the generated OTP
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { OTP: OTP }, $push: { orderStatus: newStatus } }
          );

          res.status(200).send({ orderData: result });
        } catch (e) {
          console.error(e); // Log the error
          res.status(500).send({ message: "Error in server" });
        }
      }
    );

    //calculation collecting coin
    const calculateCoin = (amount) => {
      if (!amount) {
        return 0;
      }
      return Math.floor(amount / 100);
    };

    app.patch(
      "/status-to-delivered",
      verifyJWT,
      checkPermission(["admin", "Delivery Partner"]),
      async (req, res) => {
        const OTP = req.body?.OTP;
        const orderId = req.body?.id;

        if (!orderId || !OTP) {
          return res.status(404).send({ message: "Invalid Request!" });
        }
        try {
          const orderDeliver = await ordersCollection.findOne(
            { _id: new ObjectId(orderId) },
            {
              projection: {
                userId: 1,
                _id: 1,
                OTP: 1,
                finalAmount: 1,
              },
            }
          );
          if (orderDeliver?.OTP !== OTP) {
            return res.status(422).send({ message: "Wrong OTP!" });
          }
          const newStatus = {
            name: "Delivered",
            message: `${req.body?.message}`,
            time: new Date().toISOString(),
          };
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status: "Delivered" }, $push: { orderStatus: newStatus } }
          );
          const coin = await calculateCoin(orderDeliver?.finalAmount);
          profileCollection.updateOne(
            { _id: orderDeliver?.userId },
            { $inc: { coin: coin } },
            { upsert: true }
          );
          res.status(200).send({ orderData: result });
        } catch {
          (e) => {
            res.status(500).send({ message: "error in server" });
          };
        }
      }
    );

    // cancel order + add back
    app.delete(
      "/cacnel-order/:_id",
      verifyJWT,
      checkPermission(["admin", "Order Manager"]),
      async (req, res) => {
        const orderId = req.params._id;
        if (!orderId) {
          return res.status(404).send({ message: "Invalid Request!" });
        }
        try {
          const orderDeliver = await ordersCollection.findOne(
            { _id: new ObjectId(orderId) },
            {
              projection: {
                _id: 1,
                status: 1,
              },
            }
          );
          if (!orderDeliver) {
            return res.status(404).send({ message: "No dataa!" });
          }
          if (
            orderDeliver?.status === "Delivered" ||
            orderDeliver?.status === "Cancelled"
          ) {
            return res.status(409).send({
              message: `You can't cancel a ${orderDeliver?.status} product status`,
            });
          }
          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status: "Cancelled" } }
          );

          await updateProductQuantitiesByOrder(orderId, "add");
          res.status(200).send({ orderData: result });
        } catch {
          (e) => {
            res.status(500).send({ message: "Error in Server" });
          };
        }
      }
    );

    // ---------------------Admin Stats------------------------------------------

    app.get(
      "/admin-stats",
      verifyJWT,
      checkPermission(["admin"]),
      async (req, res) => {
        const users = await userCollection.estimatedDocumentCount();

        // Count orders with status "Processing" and not "Cancelled"
        const ordersPipeline = [
          {
            $match: {
              $and: [
                { "orderStatus.name": "Processing" },
                { status: { $ne: "Cancelled" } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ];

        const ordersResult = await ordersCollection
          .aggregate(ordersPipeline)
          .next();
        const orders = ordersResult ? ordersResult.count : 0;

        // Sum of finalAmount from orders
        const finalAmountPipeline = [
          {
            $match: {
              $and: [
                { "orderStatus.name": "Processing" },
                { status: { $ne: "Cancelled" } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              totalFinalAmount: { $sum: "$finalAmount" },
            },
          },
        ];

        const finalAmountResult = await ordersCollection
          .aggregate(finalAmountPipeline)
          .next();
        const revenue = finalAmountResult
          ? finalAmountResult.totalFinalAmount
          : 0;

        // Count products with quantity greater than 0
        const productsPipeline = [
          {
            $match: {
              quantity: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ];

        const productsResult = await productsCollection
          .aggregate(productsPipeline)
          .next();
        const products = productsResult ? productsResult.count : 0;

        // Calculate total finalAmount for each month
        const finalAmountByMonthPipeline = [
          {
            $match: {
              "orderStatus.name": "Processing",
              status: { $ne: "Cancelled" },
            },
          },
          {
            $unwind: "$orderStatus",
          },
          {
            $match: {
              "orderStatus.name": "Processing",
              status: { $ne: "Cancelled" },
            },
          },
          {
            $project: {
              month: { $month: { $toDate: "$orderStatus.time" } },
              finalAmount: "$finalAmount",
            },
          },
          {
            $group: {
              _id: { month: "$month" },
              totalFinalAmount: { $sum: "$finalAmount" },
            },
          },
          {
            $sort: { "_id.month": 1 },
          },
        ];

        const finalAmountByMonthResult = await ordersCollection
          .aggregate(finalAmountByMonthPipeline)
          .toArray();

        // Convert month numbers to month names
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];

        const finalAmountByMonthWithNames = finalAmountByMonthResult.map(
          (item) => ({
            month: monthNames[item._id.month - 1], // Adjust for 0-based array
            totalFinalAmount: item.totalFinalAmount,
          })
        );

        // Calculate total number of orders per month with month numbers
        const ordersByMonthPipeline = [
          {
            $match: {
              "orderStatus.name": "Processing",
              status: { $ne: "Cancelled" },
            },
          },
          {
            $unwind: "$orderStatus",
          },
          {
            $match: {
              "orderStatus.name": "Processing",
              status: { $ne: "Cancelled" },
            },
          },
          {
            $project: {
              month: { $month: { $toDate: "$orderStatus.time" } },
            },
          },
          {
            $group: {
              _id: { month: "$month" },
              totalOrders: { $sum: 1 }, // Count orders per month
            },
          },
          {
            $sort: { "_id.month": 1 },
          },
        ];

        const ordersByMonthResult = await ordersCollection
          .aggregate(ordersByMonthPipeline)
          .toArray();

        const ordersByMonthWithNames = ordersByMonthResult.map((item) => ({
          month: monthNames[item._id.month - 1], // Adjust for 0-based array
          totalOrders: item.totalOrders,
        }));

        // Calculate total number of orders per category
        const ordersByCategoryPipeline = [
          {
            $match: {
              "orderStatus.name": "Processing",
              status: { $ne: "Cancelled" },
            },
          },
          {
            $unwind: "$orderedItems",
          },
          {
            $lookup: {
              from: "products", // Use your actual collection name
              localField: "orderedItems.productName",
              foreignField: "productTitle",
              as: "product",
            },
          },
          {
            $unwind: "$product",
          },
          {
            $project: {
              category: "$product.category",
            },
          },
          {
            $group: {
              _id: { category: "$category" },
              totalOrders: { $sum: 1 }, // Count orders per category
            },
          },
        ];

        const ordersByCategoryResult = await ordersCollection
          .aggregate(ordersByCategoryPipeline)
          .toArray();

        const ordersByCategory = ordersByCategoryResult.map((item) => ({
          category: item._id.category, // Adjust for 0-based array
          totalOrders: item.totalOrders,
        }));

        // Calculate total number of "Delivered" orders
        const deliveredOrdersPipeline = [
          {
            $match: {
              status: "Delivered",
            },
          },
          {
            $group: {
              _id: null,
              totalDeliveredOrders: { $sum: 1 },
            },
          },
        ];

        const deliveredOrdersResult = await ordersCollection
          .aggregate(deliveredOrdersPipeline)
          .toArray();

        // Calculate total number of "Cancelled" orders
        const cancelledOrdersPipeline = [
          {
            $match: {
              status: "Cancelled",
            },
          },
          {
            $group: {
              _id: null,
              totalCancelledOrders: { $sum: 1 },
            },
          },
        ];

        const cancelledOrdersResult = await ordersCollection
          .aggregate(cancelledOrdersPipeline)
          .toArray();

        // Calculate total number of "Pending" orders
        const pendingOrdersPipeline = [
          {
            $match: {
              $and: [
                { "orderStatus.name": "Processing" },
                { status: { $nin: ["Delivered", "Cancelled"] } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              totalPendingOrders: { $sum: 1 },
            },
          },
        ];

        const pendingOrdersResult = await ordersCollection
          .aggregate(pendingOrdersPipeline)
          .toArray();

        // Combine the results into an array
        const ordersStatusArray = [
          {
            status: "Delivered",
            totalOrders: deliveredOrdersResult[0]?.totalDeliveredOrders || 0,
          },
          {
            status: "Pending",
            totalOrders: pendingOrdersResult[0]?.totalPendingOrders || 0,
          },
          {
            status: "Cancelled",
            totalOrders: cancelledOrdersResult[0]?.totalCancelledOrders || 0,
          },
        ];
        res.send({
          users,
          orders,
          revenue,
          products,
          finalAmountByMonth: finalAmountByMonthWithNames,
          ordersByMonth: ordersByMonthWithNames,
          ordersByCategory: ordersByCategory,
          ordersStatusArray,
        });
      }
    );

    //-----------------------Search-----------------------------

    app.post("/search", async (req, res) => {
      const query = req.body.query;

      try {
        // Perform a search query on your products collection based on 'query'.
        const result = await productsCollection
          .find({
            $or: [
              { productTitle: { $regex: query, $options: "i" } }, // Case-insensitive title search
              { category: { $regex: query, $options: "i" } }, // Case-insensitive category search
              { subCategory: { $regex: query, $options: "i" } }, // Case-insensitive subCategory search
            ],
          })
          .toArray();
        res.json(result);
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .json({ error: "An error occurred while searching for products." });
      }
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
