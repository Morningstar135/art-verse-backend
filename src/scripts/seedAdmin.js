const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const User = require("../models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const existing = await User.findOne({ email: "admin@artverse.com" });
    if (existing) {
      console.log("Admin user already exists. Skipping seed.");
      await mongoose.disconnect();
      process.exit(0);
    }

    const admin = await User.create({
      name: "Admin",
      email: "admin@artverse.com",
      password: "changeme123",
      role: "admin",
    });

    console.log(`Admin user created: ${admin.email}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding admin: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();
