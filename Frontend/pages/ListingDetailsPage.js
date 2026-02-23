import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useFavorites } from "../../contexts/FavoritesContext";
import { useAuth } from "../../contexts/AuthContext";
import ImageGallery from "../../components/listings/details/ImageGallery";
import TechnicalDetails from "../../components/listings/details/TechnicalDetails";
import Description from "../../components/listings/details/Description";
import ContactInfo from "../../components/listings/details/ContactInfo";
import CommentSection from "../../components/listings/details/CommentSection";
import CollapsibleSection from "../../components/listings/details/CollapsibleSection";
import SimilarListings from "../../components/listings/SimilarListings";
import apiClient from "../../services/api/client";
import debugUtils from "../../utils/debug";

// --- FUNKCJA GENERUJĄCA DŁUGI URL (W stylu Otomoto) ---
const slugify = (l) => {
  const parts = [];

  if (l.condition) {
    parts.push(l.condition === "new" ? "nowy" : "uzywany");
  }

  if (l.brand) parts.push(l.brand);
  if (l.model) parts.push(l.model);
  if (l.year) parts.push(l.year);
  if (l.price) parts.push(`${l.price}zl`);
  if (l.location?.city || l.city) parts.push(l.location?.city || l.city);

  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Usuwa polskie znaki (ą -> a)
    .replace(/[^a-z0-9]+/g, "-") // Zamienia spacje i znaki specjalne na myślniki
    .replace(/^-|-$/g, "");
};

// --- KOMPONENT SEO ---
const SEO = ({ title, description, image, type = "website" }) => {
  const { pathname } = useLocation();
  const siteUrl = "https://autosell.pl";
  const fullUrl = `${siteUrl}${pathname}`;

  const defaultDescription =
    "AutoSell.pl - Nowa generacja ogłoszeń motoryzacyjnych. Stawiamy na wiarygodność";
  const defaultImage = `${siteUrl}/images/autosell-share.jpg`;

  const metaDescription = description || defaultDescription;
  const metaImage =
    typeof image === "string"
      ? image.startsWith("http")
        ? image
        : `${siteUrl}${image}`
      : defaultImage;

  return (
    <Helmet>
      <title>
        {title
          ? `${title} | AutoSell.pl`
          : "Nowa generacja ogłoszeń motoryzacyjnych. Stawiamy na wiarygodność"}
      </title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={fullUrl} />

      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta
        property="og:title"
        content={title ? `${title} | AutoSell.pl` : "AutoSell.pl"}
      />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta
        name="twitter:title"
        content={title ? `${title} | AutoSell.pl` : "AutoSell.pl"}
      />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
    </Helmet>
  );
};

const { safeConsole } = debugUtils;

const ListingDetailsPage = () => {
  // --- ROZSZYFROWYWANIE ID Z URL ---
  const params = useParams();
  const urlParam = params.slug || params.id;
  // Bierzemy ID (to co po ostatnim myślniku lub całość, jeśli myślnika nie ma)
  const id = urlParam
    ? urlParam.includes("-")
      ? urlParam.split("-").pop()
      : urlParam
    : null;

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useFavorites();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentError, setCommentError] = useState(null);
  const [commentSuccess, setCommentSuccess] = useState(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [similarListings, setSimilarListings] = useState([]);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  // --- AUTO-PRZEKIEROWANIE URL (Magia tworzenia ładnego linku) ---
  useEffect(() => {
    if (listing && id) {
      const slug = listing.slug || slugify(listing);
      const expectedUrl = `/listing/${slug}-${id}`;

      if (decodeURIComponent(location.pathname) !== expectedUrl) {
        navigate(expectedUrl, { replace: true });
      }
    }
  }, [listing, id, location.pathname, navigate]);

  const forceRefreshListing = useCallback(async () => {
    try {
      safeConsole.log("🔄 Wymuszam odświeżenie danych ogłoszenia...");
      const cacheKey = `/ads/${id}`;
      apiClient.clearCache(cacheKey);

      if ("caches" in window) {
        try {
          const baseURL = apiClient.defaults.baseURL || window.location.origin;
          const fullApiUrl = new URL(
            `${baseURL}/ads/${id}`,
            window.location.origin,
          ).href;
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            await cache.delete(fullApiUrl);
          }
        } catch (cacheError) {
          safeConsole.warn("Błąd czyszczenia cache:", cacheError);
        }
      }

      const timestamp = Date.now();
      const response = await apiClient.get(`/ads/${id}?_t=${timestamp}`);

      if (response.data) {
        safeConsole.log("✅ Pobrano dane:", response.data);
        setListing(response.data);
        return response.data;
      } else {
        throw new Error("Brak danych w odpowiedzi");
      }
    } catch (err) {
      safeConsole.error("❌ Błąd:", err);
      throw err;
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingComments(true);
      const response = await apiClient.get(`/api/comments/${id}`);
      const allComments = response.data?.comments || response.data || [];
      const approvedComments = response.data?.isAdmin
        ? allComments
        : allComments.filter((comment) => comment.status === "approved");

      const transformedComments = approvedComments.map((comment) => ({
        id: comment._id,
        text: comment.content,
        author: comment.user
          ? `${comment.user.name || ""} ${comment.user.lastName || ""}`.trim()
          : "Anonim",
        date: new Date(comment.createdAt).toLocaleDateString("pl-PL", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        createdAt: comment.createdAt,
        images: comment.images || (comment.image ? [comment.image] : []),
        userId: comment.user?._id || comment.user?.id,
        status: comment.status,
        isEditing: false,
      }));
      setComments(transformedComments);
    } catch (err) {
      safeConsole.error("Błąd komentarzy:", err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [id]);

  const fetchSimilarListings = useCallback(async (currentListing) => {
    if (!currentListing) return;
    try {
      const response = await apiClient.get("/ads", { params: { limit: 100 } });
      const allListings = response.data?.ads || response.data || [];
      const currentId = String(currentListing._id || currentListing.id);

      const otherListings = allListings.filter(
        (ad) => String(ad._id || ad.id) !== currentId,
      );
      const currentBrand = currentListing.brand?.toLowerCase() || "";
      const sameBrandListings = otherListings.filter(
        (ad) => ad.brand?.toLowerCase() === currentBrand,
      );

      setSimilarListings(sameBrandListings);
    } catch (err) {
      safeConsole.error("Błąd podobnych ogłoszeń:", err);
      setSimilarListings([]);
    }
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("payment") === "success") {
      setShowPaymentSuccess(true);
      setTimeout(() => {
        setShowPaymentSuccess(false);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }, 5000);
    }
  }, [location.search]);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);
        const listingData = await forceRefreshListing();
        await fetchComments();
        if (listingData) {
          await fetchSimilarListings(listingData);
        }
      } catch (err) {
        safeConsole.error("Błąd pobierania:", err);
        setError(err.message || "Nie udało się pobrać ogłoszenia");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchListing();
  }, [id, forceRefreshListing, fetchComments, fetchSimilarListings]);

  const refreshListing = useCallback(async () => {
    try {
      setLoading(true);
      await forceRefreshListing();
    } catch (err) {
      setError(err.message || "Nie udało się odświeżyć ogłoszenia");
    } finally {
      setLoading(false);
    }
  }, [forceRefreshListing]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === `listing_updated_${id}`) {
        safeConsole.log("🔄 Wykryto aktualizację...");
        refreshListing();
        localStorage.removeItem(`listing_updated_${id}`);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    if (localStorage.getItem(`listing_updated_${id}`)) {
      refreshListing();
      localStorage.removeItem(`listing_updated_${id}`);
    }
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [id, refreshListing]);

  const handleAddComment = async (content, imageFiles) => {
    if (!user) {
      navigate("/login");
      return false;
    }
    try {
      setCommentError(null);
      const formData = new FormData();
      formData.append("content", content);
      if (imageFiles && imageFiles.length > 0) {
        imageFiles.forEach((file) => formData.append("images", file));
      }

      const API_URL = apiClient.defaults.baseURL || "http://localhost:5000";
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const fetchResponse = await fetch(`${API_URL}/api/comments/${id}`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse
          .json()
          .catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || "Upload failed");
      }
      await fetchComments();
      return true;
    } catch (err) {
      safeConsole.error("Błąd dodawania komentarza:", err);
      let errorMessage = "Błąd podczas dodawania komentarza.";
      if (err.response?.status === 429) errorMessage = "Poczekaj chwilę.";
      else if (err.response?.data?.message)
        errorMessage = err.response.data.message;
      setCommentError(errorMessage);
      return false;
    }
  };

  const handleEditComment = (commentId) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, isEditing: true } : c)),
    );
  };

  const handleSaveComment = async (commentId, newText) => {
    try {
      setCommentSuccess(null);
      setCommentError(null);
      const response = await apiClient.patch(`/api/comments/${commentId}`, {
        content: newText,
      });
      if (response.data) {
        setCommentSuccess("Komentarz zaktualizowany. Czeka na moderację.");
        await fetchComments();
      }
    } catch (err) {
      safeConsole.error("Błąd zapisu komentarza:", err);
      setCommentError("Nie udało się zapisać komentarza.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Usunąć komentarz?")) return;
    try {
      setCommentSuccess(null);
      setCommentError(null);
      await apiClient.delete(`/api/comments/${commentId}`);
      setCommentSuccess("Komentarz usunięty.");
      await fetchComments();
    } catch (err) {
      safeConsole.error("Błąd usuwania komentarza:", err);
      setCommentError("Nie udało się usunąć komentarza.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#2E7D32]"></div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error ? "Wystąpił błąd" : "Ogłoszenie nie znalezione"}
          </h2>
          <button
            onClick={() => navigate("/")}
            className="bg-[#2E7D32] text-white px-6 py-2 rounded-lg hover:bg-[#1B5E20]"
          >
            Wróć do strony głównej
          </button>
        </div>
      </div>
    );
  }

  // --- BEZPIECZNE POBIERANIE ZDJĘCIA ---
  const rawImage = listing.photos?.[0] || listing.images?.[0];
  const mainImage =
    typeof rawImage === "string"
      ? rawImage
      : rawImage?.url || rawImage?.path || "/placeholder-car.jpg";

  const seoTitle = `${listing.brand} ${listing.model} ${listing.year} - ${listing.price} PLN`;
  const seoDescription = `Sprzedam ${listing.brand} ${listing.model} z roku ${listing.year}. Przebieg: ${listing.mileage || "Brak"} km, Cena: ${listing.price} PLN.`;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={mainImage}
        type="article"
      />

      <div className="min-h-screen bg-gray-50">
        {/* Baner płatności */}
        {showPaymentSuccess && (
          <div className="bg-green-600 text-white py-4 px-4 shadow-lg">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-bold">Płatność zakończona sukcesem!</p>
                  <p className="text-sm">
                    Twoje ogłoszenie zostało opublikowane i jest już widoczne.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentSuccess(false)}
                className="text-white hover:text-gray-200"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* LEWA KOLUMNA */}
            <div className="lg:col-span-3 space-y-4 lg:space-y-6">
              <ImageGallery images={listing.photos || listing.images || []} />

              {listing.headline && (
                <div className="bg-white p-6 shadow-md rounded-sm">
                  <h2 className="text-xl font-bold mb-4 text-black">
                    Nagłówek ogłoszenia
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-md border-l-4 border-[#2E7D32]">
                    <p className="text-lg font-medium text-gray-800">
                      {listing.headline}
                    </p>
                  </div>
                </div>
              )}

              {/* Detale techniczne tylko dla Mobile */}
              <div className="lg:hidden">
                <TechnicalDetails listing={listing} />
              </div>

              {/* Opis dla Mobile (Zwijany) */}
              <div className="lg:hidden">
                <CollapsibleSection
                  title="Opis pojazdu"
                  defaultOpen={true}
                  contentClassName="pt-4"
                >
                  <Description description={listing.description} />
                </CollapsibleSection>
              </div>

              {/* Opis dla Desktopu (Zawsze otwarty) */}
              <div className="hidden lg:block">
                <Description description={listing.description} />
              </div>

              {/* SEKCJA KOMENTARZY */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Komentarze
                  </h2>
                </div>

                {/* Komunikaty inline zamiast alert() */}
                {commentSuccess && (
                  <div className="mx-6 mt-4 px-4 py-3 bg-green-50 border border-green-300 text-green-700 rounded text-sm">
                    {commentSuccess}
                  </div>
                )}
                {commentError && (
                  <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">
                    {commentError}
                  </div>
                )}

                <div className="p-6">
                  <CommentSection
                    comments={comments}
                    onAddComment={handleAddComment}
                    onEditComment={handleEditComment}
                    onSaveComment={handleSaveComment}
                    onDeleteComment={handleDeleteComment}
                    userId={user?.id || user?._id}
                    commentError={commentError}
                    isWrapped={true}
                  />
                </div>
              </div>
            </div>

            {/* PRAWA KOLUMNA (Desktop) / Wpadająca niżej (Mobile) */}
            <div className="lg:col-span-2">
              <div className="sticky top-6 space-y-4 lg:space-y-6">
                {/* Detale techniczne tylko dla Desktopu */}
                <div className="hidden lg:block">
                  <TechnicalDetails listing={listing} />
                </div>

                {/* Informacje kontaktowe */}
                <ContactInfo listing={listing} />
              </div>
            </div>
          </div>

          {/* PODOBNE OGŁOSZENIA */}
          {similarListings.length > 0 && (
            <div className="mt-6">
              <SimilarListings
                listings={similarListings}
                currentBrand={listing?.brand}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ListingDetailsPage;
