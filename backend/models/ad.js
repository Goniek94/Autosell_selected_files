import mongoose from "mongoose";

const AdSchema = new mongoose.Schema(
  {
    // Tytuł (stare rekordy mogą mieć 'headline' – obsługujemy w kontrolerze)
    title: { type: String, required: false, index: true },

    description: { type: String, default: "" },

    // Autor – nowe rekordy 'user', stare mogły mieć 'owner'
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    // Legacy
    headline: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    ownerName: { type: String, default: "" },
    ownerLastName: { type: String, default: "" },
    ownerEmail: { type: String, default: "" },
    ownerPhone: { type: String, default: "" },
    ownerRole: { type: String, default: "user" },

    // Dane katalogowe (opcjonalne)
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    generation: { type: String, default: "" },
    version: { type: String, default: "" },
    year: { type: Number, default: null },
    productionYear: { type: Number, default: null }, // alias for yeara
    mileage: { type: Number, default: null },
    fuelType: { type: String, default: "" },
    transmission: { type: String, default: "" },

    // Vehicle identification
    vin: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    firstRegistrationDate: { type: Date, default: null },

    // Technical data
    power: { type: Number, default: null }, // Engine power in KM
    engineSize: { type: Number, default: null }, // Engine capacity in cm³
    drive: { type: String, default: "" }, // FWD, RWD, AWD/4x4
    weight: { type: Number, default: null }, // Vehicle weight in kg
    lastOfficialMileage: { type: Number, default: null }, // CEPiK mileage
    paintFinish: { type: String, default: "" }, // Metalik, Perła, Mat, Połysk, Inne

    // Body and interior
    bodyType: { type: String, default: "" }, // Sedan, Hatchback, Kombi, SUV, etc.
    color: { type: String, default: "" },
    doors: { type: Number, default: null }, // 1-6
    seats: { type: Number, default: null }, // 2-9+

    // Vehicle condition
    condition: { type: String, default: "" }, // Nowy, Używany
    accidentStatus: { type: String, default: "" }, // Bezwypadkowy, Powypadkowy
    damageStatus: { type: String, default: "" }, // Nieuszkodzony, Uszkodzony
    tuning: { type: String, default: "" }, // Tak, Nie
    countryOfOrigin: { type: String, default: "" },
    imported: { type: String, default: "Nie" }, // Tak, Nie
    registeredInPL: { type: String, default: "Tak" }, // Tak, Nie
    firstOwner: { type: String, default: "Nie" }, // Tak, Nie
    disabledAdapted: { type: String, default: "Nie" }, // Tak, Nie

    // Seller information
    sellerType: { type: String, default: "Prywatny" }, // Prywatny, Firma

    // Location
    voivodeship: { type: String, default: "" },
    city: { type: String, default: "" },

    // Purchase options
    purchaseOptions: { type: String, default: "Sprzedaż" }, // Sprzedaż, Faktura VAT, Inne, Najem, Leasing, Cesja, Zamiana
    listingType: { type: String, default: "standardowe" }, // standardowe, wyróżnione
    negotiable: { type: String, default: "Nie" }, // Tak, Nie

    // Rental fields (Najem)
    rentalPrice: { type: Number, default: null }, // Monthly rental price

    // Leasing/Cession fields (Cesja leasingu)
    leasingCompany: { type: String, default: "" }, // Leasing company/bank name (Firma leasingowa/bank)
    remainingInstallments: { type: Number, default: null }, // Number of remaining installments (Pozostałe raty)
    installmentAmount: { type: Number, default: null }, // Monthly installment amount (Wysokość raty)
    cessionFee: { type: Number, default: null }, // Cession fee (Opłata za cesję)

    // Exchange fields (Zamiana)
    exchangeOffer: { type: String, default: "" }, // What the seller is looking for in exchange
    exchangeValue: { type: Number, default: null }, // Estimated value of exchange
    exchangePayment: { type: Number, default: null }, // Additional payment (can be negative)
    exchangeConditions: { type: String, default: "" }, // Exchange conditions/requirements

    // Descriptions
    shortDescription: { type: String, default: "" }, // Up to 120 characters

    // Ceny / promocje
    price: { type: Number, required: false, min: 0, default: 0 },
    discount: { type: Number, default: 0, min: 0, max: 99 },
    discountedPrice: { type: Number, default: null },

    // Obrazy
    images: { type: [String], default: [] },
    mainImage: { type: String, default: "" },
    cover: { type: String, default: "" }, // legacy

    // Status moderacji
    status: {
      type: String,
      // ZMIANA: Dodano "pending_payment" i ustawiono jako domyślny
      enum: [
        "pending_payment",
        "pending",
        "approved",
        "rejected",
        "active",
        "hidden",
        "archived",
      ],
      default: "pending_payment",
      index: true,
    },

    // Wyróżnienia & ekspozycja
    featured: { type: Boolean, default: false, index: true },
    featuredAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true }, // do „przedłuż"

    moderation: {
      approvedAt: { type: Date },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectedAt: { type: Date },
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectReason: { type: String, default: "" },
      hiddenAt: { type: Date },
      hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      hideReason: { type: String, default: "" },
    },

    // Analytics & engagement
    views: { type: Number, default: 0, min: 0 }, // Number of times ad was viewed
    favorites: { type: Number, default: 0, min: 0 }, // Number of users who favorited
    favoritedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ], // Users who favorited this ad
  },
  { timestamps: true },
);

/* ----------------------------- Metody rabatów ----------------------------- */
AdSchema.methods.applyPercentDiscount = function (pct) {
  const p = Number(pct) || 0;
  const clamped = Math.max(0, Math.min(99, p));
  this.discount = clamped;
  this.discountedPrice =
    clamped > 0 ? Math.round(this.price * (1 - clamped / 100)) : null;
};

AdSchema.methods.applyFlatDiscount = function (amount) {
  const a = Math.max(0, Number(amount) || 0);
  const newPrice = Math.max(0, this.price - a);
  this.discount =
    this.price > 0 ? Math.round((1 - newPrice / this.price) * 100) : 0;
  this.discountedPrice = newPrice;
};

AdSchema.methods.clearDiscount = function () {
  this.discount = 0;
  this.discountedPrice = null;
};

/* --------------------------- Przedłużanie ekspozycji --------------------------- */
AdSchema.methods.extendDays = function (days = 30) {
  const d = Math.max(1, Number(days) || 30);
  const base =
    this.expiresAt && this.expiresAt > new Date() ? this.expiresAt : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + d);
  this.expiresAt = next;
};

/* ---------------------- Spójność rabatu przy zapisie ---------------------- */
AdSchema.pre("save", function (next) {
  if (typeof this.discount !== "number") this.discount = 0;
  this.discount = Math.max(0, Math.min(99, this.discount));
  if (this.discount > 0) {
    this.discountedPrice = Math.round(this.price * (1 - this.discount / 100));
  } else {
    this.discountedPrice = null;
  }
  next();
});

const Ad = mongoose.model("Ad", AdSchema);
export default Ad;
