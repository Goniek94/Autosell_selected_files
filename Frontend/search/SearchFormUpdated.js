// SearchFormUpdated.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BasicFilters from "./BasicFilters";
import AdvancedFilters from "./AdvancedFilters";
import SearchFormButtons from "./SearchFormButtons";
import { bodyTypes, advancedOptions, regions } from "./SearchFormConstants";
import AdsService from "../../services/ads";
import useCarData from "./hooks/useCarData";
import useSearchStats from "./hooks/useSearchStats";
import useFilterCounts from "./hooks/useFilterCounts";
import debugUtils from "../../utils/debug";

const { safeConsole } = debugUtils;

/**
 * Zaktualizowany komponent formularza wyszukiwania
 * Używa hooka useCarData do pobierania danych o markach i modelach z backendu
 *
 * @param {object} props
 * @param {object} props.initialValues - początkowe wartości formularza
 * @param {function} [props.onFilterChange] - callback do przekazania filtrów do rodzica
 */
export default function SearchFormUpdated({
  initialValues = {},
  onFilterChange,
}) {
  const navigate = useNavigate();

  // Pozwól na przekazanie 'brand' zamiast 'make' w initialValues
  const sanitizedInitialValues = { ...initialValues };
  if (sanitizedInitialValues.brand && !sanitizedInitialValues.make) {
    sanitizedInitialValues.make = sanitizedInitialValues.brand;
    delete sanitizedInitialValues.brand;
  }

  // Pobierz dane o markach i modelach z backendu
  const {
    carData,
    brands,
    getModelsForBrand,
    getGenerationsForModel,
    loading,
    error,
  } = useCarData();

  // Stan formularza
  const [formData, setFormData] = useState(() => ({
    make: [], // Checklist - musi być tablica
    model: [], // Checklist - musi być tablica
    generation: [], // Checklist - musi być tablica
    priceFrom: "",
    priceTo: "",
    yearFrom: "",
    yearTo: "",
    bodyType: [], // Checklist - musi być tablica
    damageStatus: "",
    country: "",
    region: [], // Checklist - musi być tablica
    city: [], // Checklist - musi być tablica
    fuelType: [], // Checklist - musi być tablica
    driveType: "",
    mileageFrom: "",
    mileageTo: "",
    location: "",
    transmission: [], // Checklist - musi być tablica
    enginePowerFrom: "",
    enginePowerTo: "",
    engineCapacityFrom: "",
    engineCapacityTo: "",
    color: [], // Checklist - musi być tablica
    doorCount: [], // Checklist - musi być tablica
    tuning: "",
    condition: [], // Checklist - musi być tablica
    accidentStatus: "",
    countryOfOrigin: [], // Checklist - musi być tablica
    finish: [], // Checklist - musi być tablica
    weightFrom: "",
    weightTo: "",
    vehicleCondition: "",
    sellingForm: "",
    sellerType: "",
    vat: false,
    invoiceOptions: false,
    imported: false,
    registeredInPL: false,
    firstOwner: false,
    disabledAdapted: false,
    ...sanitizedInitialValues,
  }));

  // Hook do statystyk wyszukiwania w czasie rzeczywistym
  const { stats } = useSearchStats(formData);

  // Hook do liczników filtrów - nowy system kaskadowego filtrowania
  const {
    totalMatching,
    getColorCount,
    getCountryOfOriginCount,
    loading: countsLoading,
  } = useFilterCounts(formData);

  // Dostępne modele dla wybranej marki
  const [availableModels, setAvailableModels] = useState([]);

  // Pokaż zaawansowane filtry
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Liczba pasujących wyników z backendu - używamy nowego hooka
  const matchingResults = totalMatching;

  // Funkcja resetująca wszystkie filtry
  const resetAllFilters = () => {
    // Lista wszystkich pól formularza do zresetowania
    const defaultFormData = {
      make: [], // Checklist - musi być tablica
      model: [], // Checklist - musi być tablica
      generation: [], // Checklist - musi być tablica
      priceFrom: "",
      priceTo: "",
      yearFrom: "",
      yearTo: "",
      bodyType: [], // Checklist - musi być tablica
      damageStatus: "",
      country: "",
      region: [], // Checklist - musi być tablica
      city: [], // Checklist - musi być tablica
      fuelType: [], // Checklist - musi być tablica
      driveType: "",
      mileageFrom: "",
      mileageTo: "",
      location: "",
      transmission: [], // Checklist - musi być tablica
      enginePowerFrom: "",
      enginePowerTo: "",
      engineCapacityFrom: "",
      engineCapacityTo: "",
      color: [], // Checklist - musi być tablica
      doorCount: [], // Checklist - musi być tablica
      tuning: "",
      condition: [], // Checklist - musi być tablica
      accidentStatus: "",
      countryOfOrigin: [], // Checklist - musi być tablica
      finish: [], // Checklist - musi być tablica
      weightFrom: "",
      weightTo: "",
      sellerType: "",
      imported: false,
      registeredInPL: false,
      firstOwner: false,
      disabledAdapted: false,
      vehicleCondition: "",
      sellingForm: "",
      vat: false,
      invoiceOptions: false,
    };

    // Resetuj formularze
    setFormData(defaultFormData);

    // Resetuj dostępne modele
    setAvailableModels([]);
  };

  // Aktualizuj dostępne modele, gdy zmienia się marka
  useEffect(() => {
    const updateModels = async () => {
      if (formData.make && formData.make.length > 0) {
        // Jeśli wybrano jedną markę, pobierz jej modele
        if (formData.make.length === 1) {
          const models = await getModelsForBrand(formData.make[0]);
          setAvailableModels(models);
        } else {
          // Jeśli wybrano wiele marek, pobierz modele dla wszystkich wybranych marek
          let allModels = [];
          for (const brand of formData.make) {
            const models = await getModelsForBrand(brand);
            allModels = [...allModels, ...models];
          }
          // Usuń duplikaty i posortuj
          const uniqueModels = [...new Set(allModels)].sort();
          setAvailableModels(uniqueModels);
        }
      } else {
        setAvailableModels([]);
      }
    };

    updateModels();
  }, [formData.make, getModelsForBrand]);

  // Obsługa zmiany pól formularza
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      let finalValue = value;
      if (
        [
          "priceFrom",
          "priceTo",
          "mileageFrom",
          "mileageTo",
          "enginePowerFrom",
          "enginePowerTo",
          "engineCapacityFrom",
          "engineCapacityTo",
        ].includes(name)
      ) {
        if (Number(value) < 0) finalValue = 0;
      }
      setFormData((prev) => ({ ...prev, [name]: finalValue }));
    }
  };

  // Obsługa przycisku wyszukiwania
  const handleSearch = () => {
    // ZAWSZE zamieniaj 'make' na 'brand' przed wysłaniem
    const filtersToSend = { ...formData };
    if (filtersToSend.make) {
      filtersToSend.brand = filtersToSend.make;
      delete filtersToSend.make;
    }

    if (onFilterChange) {
      onFilterChange(filtersToSend);
    } else {
      // Przejdź do strony wyników wyszukiwania
      const searchParams = new URLSearchParams();

      // Przekształć parametry formularza na parametry URL
      Object.entries(filtersToSend).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          // Użyj klucza bez zmian (make już zamienione na brand)
          const paramName = key;

          if (typeof value === "boolean") {
            searchParams.append(paramName, value.toString());
          } else if (Array.isArray(value)) {
            // Handle arrays - append each value separately with [] notation
            if (value.length > 0) {
              value.forEach((item) => {
                if (item !== "" && item !== null && item !== undefined) {
                  searchParams.append(`${paramName}[]`, item);
                }
              });
            }
          } else {
            searchParams.append(paramName, value);
          }
        }
      });

      const finalURL = `/listings?${searchParams.toString()}`;
      navigate(finalURL);
    }
  };

  // Generuj opcje lat
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      { length: currentYear - 1949 },
      (_, i) => currentYear - i,
    );
  };

  return (
    <section>
      {/* Komunikat o ładowaniu - ukryty */}
      {/* {loading && (
        <div className="bg-blue-50 p-3 mb-4 rounded-md text-blue-700 text-center">
          Ładowanie danych o markach i modelach...
        </div>
      )} */}

      <div className="bg-white p-3 sm:p-4 md:p-5 shadow-xl shadow-gray-300/60 rounded-[2px] mb-3 sm:mb-4 max-w-7xl mx-auto border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-bold text-[#2E7D32]">
            Filtry wyszukiwania
          </h2>
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs sm:text-sm text-[#2E7D32] hover:text-[#1B5E20] hover:underline self-start sm:self-auto"
          >
            Wyczyść wszystkie filtry
          </button>
        </div>

        <BasicFilters
          formData={formData}
          handleInputChange={handleInputChange}
          carData={carData}
          bodyTypes={bodyTypes}
          availableModels={availableModels}
          generateYearOptions={generateYearOptions}
          advancedOptions={advancedOptions}
          regions={regions}
          getGenerationsForModel={getGenerationsForModel}
        />

        {showAdvanced && (
          <AdvancedFilters
            formData={formData}
            handleInputChange={handleInputChange}
            advancedOptions={advancedOptions}
            regions={regions}
            carData={carData}
            resetAllFilters={resetAllFilters}
            getColorCount={getColorCount}
            getCountryOfOriginCount={getCountryOfOriginCount}
          />
        )}

        <SearchFormButtons
          formData={formData}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          handleSearch={handleSearch}
          matchingResults={matchingResults}
          totalResults={stats.totalCount}
        />
      </div>
    </section>
  );
}
