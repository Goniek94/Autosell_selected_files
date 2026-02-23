// routes/index.js

// Organized imports from new structure
import userRoutes from "./user/userRoutes.js";
import adRoutes from "./listings/adRoutes.js";
import adCrudRoutes from "./listings/adCrudRoutes.js";
import notificationRoutes from "./notifications/notificationRoutes.js";
import transactionRoutes from "./payments/transactionRoutes.js";
import paymentRoutes from "./payments/paymentRoutes.js";
import commentRoutes from "./listings/commentRoutes.js";
import cepikRoutes from "./external/cepikRoutes.js";
import messagesRoutes from "./communication/messagesRoutes.js";
import favoriteRoutes from "./listings/favoriteRoutes.js";
import statsRoutes from "./listings/statsRoutes.js";
import imageRoutes from "./media/imageRoutes.js";
import carBrandsRoutes from "./listings/carBrandsRoutes.js";
import searchStatsRoutes from "./listings/searchStatsRoutes.js";

// 👇 Zostawiamy import, ale NIE montujemy promoCodeRoutes w pętli
import promoCodeRoutes from "./promoCode.js";

// Import organized route modules
import * as userRoutesModule from "./user/index.js";
import * as listingsRoutesModule from "./listings/index.js";
import * as mediaRoutesModule from "./media/index.js";
import * as communicationRoutesModule from "./communication/index.js";
import * as notificationsRoutesModule from "./notifications/index.js";
import * as paymentsRoutesModule from "./payments/index.js";
import * as externalRoutesModule from "./external/index.js";

// New Enterprise Admin Panel
import enterpriseAdminRoutes from "../admin/routes/index.js";

export default (app) => {
  // ========================================
  // 🚀 ENTERPRISE ADMIN PANEL
  // ========================================
  app.use("/api/admin-panel", enterpriseAdminRoutes);

  // ========================================
  // 📊 MAIN API ROUTES (v1) - MINIMAL
  // ========================================
  const coreRoutes = {
    users: userRoutes,
    ads: adRoutes,
    comments: commentRoutes,
    images: imageRoutes,
    "car-brands": carBrandsRoutes,
    messages: messagesRoutes,
    notifications: notificationRoutes,
    transactions: transactionRoutes,
    payments: paymentRoutes,
    favorites: favoriteRoutes,
    cepik: cepikRoutes,
    // ❌ usuwamy "promo-codes" z pętli, żeby nie montować pod wieloma bazami
  };

  // ========================================
  // 📈 SPECIAL ROUTES (MUST BE FIRST!)
  // ========================================
  app.use("/api/v1/ads/stats", statsRoutes);
  app.use("/api/ads/stats", statsRoutes);
  app.use("/api/v1/ads/search-stats", searchStatsRoutes);
  app.use("/api/ads/search-stats", searchStatsRoutes);

  // ========================================
  // 🔗 ROUTE REGISTRATION - MINIMAL
  // (zostawiam jak było dla reszty usług)
  // ========================================
  Object.entries(coreRoutes).forEach(([path, router]) => {
    app.use(`/api/v1/${path}`, router);
    app.use(`/api/${path}`, router); // Backward compatibility
    if (path !== "admin") {
      app.use(`/${path}`, router); // Legacy support
    }
  });

  // ✅ PROMO CODES — JEDNA BAZA I KONIEC
  app.use("/api/promo-codes", promoCodeRoutes);

  // Authentication aliases
  const authAliases = ["/api/v1/auth", "/api/auth", "/auth"];
  authAliases.forEach((alias) => {
    app.use(alias, userRoutes);
  });

  // ========================================
  // 📋 MINIMAL API DOCUMENTATION - HTTP 431 FIX
  // ========================================
  app.get("/api", (_req, res) => {
    res.json({
      service: "Marketplace API",
      version: "2.0.0",
      status: "online",
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // ========================================
  // 🚨 MINIMAL ERROR HANDLING
  // ========================================
  app.use("/api/*", (req, res) => {
    res
      .status(404)
      .json({ error: "API endpoint not found", path: req.originalUrl });
  });
};
