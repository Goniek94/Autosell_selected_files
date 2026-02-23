import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import AdsService from "../../services/ads";
import MainFeatureListing from "./MainFeatureListing";
import SmallListingCard from "./SmallListingCard";
import HorizontalAdBanner from "../common/HorizontalAdBanner";
import { getListingUrl } from "../../utils/urlHelpers";

const FeaturedListings = () => {
  const navigate = useNavigate(); // ✅ Hook nawigacji
  const [featuredListings, setFeaturedListings] = useState([]);
  const [hotListings, setHotListings] = useState([]);
  const [normalListings, setNormalListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ FUNKCJA NAWIGACJI - używa centralnej funkcji getListingUrl
  const navigateToListing = useCallback(
    (listing) => {
      if (listing) {
        const url = getListingUrl(listing);
        navigate(url);
      }
    },
    [navigate],
  );

  // Sprawdzenie, czy użytkownik właśnie został wylogowany
  useEffect(() => {
    const justLoggedOut = localStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      setShowLogoutMessage(true);
      localStorage.removeItem("justLoggedOut");

      const timer = setTimeout(() => {
        setShowLogoutMessage(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await AdsService.getRotatedListings();
      console.log("📦 Odpowiedź z API:", response);

      let data = response;
      if (response && response.data) {
        data = response.data;
      }

      if (data && data.featured && data.hot && data.regular) {
        setFeaturedListings(data.featured || []);
        setHotListings(data.hot || []);
        setNormalListings(data.regular || []);
        setError(null);
      } else {
        throw new Error("Niepełna odpowiedź API");
      }
    } catch (err) {
      // Fallback
      try {
        const fallbackResponse = await AdsService.getAll({ limit: 50 });
        let allAds = [];
        if (fallbackResponse && fallbackResponse.data) {
          if (Array.isArray(fallbackResponse.data)) {
            allAds = fallbackResponse.data;
          } else if (
            fallbackResponse.data.ads &&
            Array.isArray(fallbackResponse.data.ads)
          ) {
            allAds = fallbackResponse.data.ads;
          }
        } else if (Array.isArray(fallbackResponse)) {
          allAds = fallbackResponse;
        }

        if (allAds.length > 0) {
          const validAds = allAds.filter(
            (ad) => ad && ad._id && ad.brand && ad.model,
          );
          const featured = validAds.slice(0, 2);
          const hot = validAds.slice(2, 6);
          const regular = validAds.slice(6, 10);

          setFeaturedListings(featured);
          setHotListings(hot);
          setNormalListings(regular);
          setError(null);
        } else {
          throw new Error("Brak ogłoszeń w bazie danych");
        }
      } catch (fallbackErr) {
        setFeaturedListings([]);
        setHotListings([]);
        setNormalListings([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
  };

  useEffect(() => {
    fetchListings();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-[#2E7D32] border-t-transparent rounded-full mb-4"></div>
        <div className="text-xl text-gray-600">Ładowanie ogłoszeń...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={handleRefresh}
            className="bg-[#2E7D32] text-white px-4 py-2 rounded hover:bg-[#1B5E20] transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {showLogoutMessage && (
        <div className="fixed top-4 left-2 right-2 sm:top-20 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50 bg-green-100 border border-green-400 text-green-700 px-3 py-2 sm:px-6 sm:py-3 rounded shadow-lg flex items-center text-sm sm:text-base">
          <FaCheckCircle className="text-green-500 mr-2 flex-shrink-0" />
          <span className="flex-1">Zostałeś pomyślnie wylogowany</span>
          <button
            onClick={() => setShowLogoutMessage(false)}
            className="ml-2 sm:ml-4 text-green-800 hover:text-green-900 focus:outline-none flex-shrink-0"
          >
            <FaTimesCircle />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 pt-0 pb-8 sm:pb-10 md:pb-12">
        <div
          className="text-center mb-3 sm:mb-4 md:mb-6 px-2"
          style={{ marginTop: "-10px" }}
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">
            OGŁOSZENIA
            <div className="w-12 sm:w-16 md:w-24 h-0.5 bg-[#2E7D32] mx-auto mt-1 sm:mt-2" />
          </h1>
        </div>

        {featuredListings.length === 0 &&
        hotListings.length === 0 &&
        normalListings.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-xl text-gray-600 mb-4">
              Brak ogłoszeń do wyświetlenia
            </div>
            <p className="text-gray-500">
              Dodaj pierwsze ogłoszenia lub sprawdź połączenie z bazą danych
            </p>
          </div>
        ) : (
          <>
            {/* 2 duże ogłoszenia */}
            {featuredListings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {featuredListings.map((listing) => (
                  <MainFeatureListing
                    key={listing._id}
                    listing={listing}
                    // ✅ Przekazujemy funkcję nawigacji
                    onNavigate={() => navigateToListing(listing)}
                  />
                ))}
              </div>
            )}

            <HorizontalAdBanner variant="default" />

            {/* 4 gorące oferty */}
            {hotListings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {hotListings.slice(0, 4).map((listing) => (
                  <SmallListingCard
                    key={listing._id}
                    listing={listing}
                    showHotOffer={true}
                    // ✅ Przekazujemy funkcję nawigacji
                    onNavigate={() => navigateToListing(listing)}
                  />
                ))}
              </div>
            )}

            {/* Baner AutoSell */}
            <div className="relative shadow-lg rounded-[2px] h-40 mb-10 flex items-center justify-center overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, #2E7D32 0%, #2D4A06 25%, #1a2f04 50%, #2D4A06 75%, #2E7D32 100%)",
                }}
              ></div>
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              ></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
              <div className="relative z-10 text-center">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold drop-shadow-lg mb-2">
                  <span className="text-yellow-400">Auto</span>
                  <span className="text-white">sell.pl</span>
                </h2>
                <p className="text-lg sm:text-xl lg:text-2xl font-medium drop-shadow-lg text-white opacity-90">
                  Znajdź swój wymarzony samochód
                </p>
              </div>
            </div>

            {/* Pozostałe ogłoszenia */}
            {normalListings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {normalListings.map((listing) => (
                  <SmallListingCard
                    key={listing._id}
                    listing={listing}
                    // ✅ Przekazujemy funkcję nawigacji
                    onNavigate={() => navigateToListing(listing)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex justify-center mt-8 sm:mt-10 lg:mt-12">
          <Link
            to="/listings"
            className="bg-[#2E7D32] text-white px-6 py-2.5 rounded-[2px] hover:bg-[#1B5E20] transition-colors text-sm font-medium"
          >
            Przejdź do ogłoszeń
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FeaturedListings;
