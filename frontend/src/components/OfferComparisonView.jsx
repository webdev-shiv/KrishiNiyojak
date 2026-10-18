import React, { useState, useEffect } from 'react';
import { 
  Tractor, 
  Star, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Fuel, 
  UserCheck, 
  Truck, 
  Mic, 
  Volume2, 
  VolumeX, 
  ArrowUpDown, 
  CheckCircle2, 
  Info, 
  ArrowLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';

export const OfferComparisonView = ({ 
  offers: offersProp = [], 
  requestDetails: requestDetailsProp = {}, 
  offersData,
  totalAvailable,
  onSelectOffer, 
  onBack, 
  onClose,
  lang = 'hi', 
  t 
}) => {
  const offers = offersData?.offers || offersProp || [];
  const requestDetails = offersData?.requestDetails || requestDetailsProp || {};
  const handleBack = onBack || onClose;
  const availableCount = totalAvailable ?? offersData?.totalAvailable ?? offers.length;

  const [filter, setFilter] = useState('best_match'); // best_match, price, rating, arrival
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [voiceExplanation, setVoiceExplanation] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Initialize comparison selection with top 2 offers if available
  useEffect(() => {
    if (offers.length >= 2 && selectedForComparison.length === 0) {
      setSelectedForComparison([offers[0].offer_id, offers[1].offer_id]);
    }
  }, [offers]);

  // Cancel any speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSelectForComparison = (offerId) => {
    setSelectedForComparison(prev => {
      if (prev.includes(offerId)) {
        return prev.filter(id => id !== offerId);
      }
      if (prev.length >= 2) {
        return [prev[1], offerId]; // shift window
      }
      return [...prev, offerId];
    });
  };

  // Sort offers based on selected filter
  const sortedOffers = [...offers].sort((a, b) => {
    if (filter === 'price') return a.total_price - b.total_price;
    if (filter === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (filter === 'arrival') return (a.estimated_arrival_minutes || 999) - (b.estimated_arrival_minutes || 999);
    return 0; // best_match preserves backend rank
  });

  const handleVoiceCompare = async () => {
    if (selectedForComparison.length < 2) {
      alert(lang === 'hi' ? 'कृपया तुलना करने के लिए दो ऑफ़र चुनें' : 'Please select 2 offers to compare');
      return;
    }

    const offerA = offers.find(o => o.offer_id === selectedForComparison[0]);
    const offerB = offers.find(o => o.offer_id === selectedForComparison[1]);

    if (!offerA || !offerB) return;

    setIsExplaining(true);
    try {
      const question = lang === 'hi'
        ? `₹${offerA.rate_per_acre || offerA.total_price} और ₹${offerB.rate_per_acre || offerB.total_price} वाली मशीन में क्या अंतर है?`
        : `What is the difference between offer from ${offerA.chc_name} and ${offerB.chc_name}?`;

      const result = await nitiClient.explainOffersVoice(offerA, offerB, question, lang);
      setVoiceExplanation(result);

      // Play synthesized voice aloud
      if ('speechSynthesis' in window && result.explanation_text) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(result.explanation_text);
        utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
        utterance.rate = 0.95;
        utterance.onstart = () => setIsPlayingAudio(true);
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('Voice comparison error:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-niti-forest/10">
        <div>
          <button 
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-niti-forest hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {lang === 'hi' ? 'अनुरोध बदलें' : 'Back to Request'}
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-niti-forest flex items-center gap-2">
            <span>{lang === 'hi' ? 'सत्यापित सीएचसी ऑफ़र तुलना' : 'CHC Machine Offer Comparison'}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-niti-forest/10 text-niti-forest font-bold">
              {availableCount} {lang === 'hi' ? 'उपलब्ध' : 'Available'}
            </span>
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            {lang === 'hi' 
              ? `${requestDetails.farm_area || 5} एकड़ ${requestDetails.crop || 'फसल'} के लिए ${requestDetails.operation || 'काम'} हेतु वास्तविक दरें`
              : `Real quotes for ${requestDetails.farm_area || 5} acres ${requestDetails.crop || 'crop'} • ${requestDetails.field_location || 'Field'}`}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('best_match')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'best_match' 
                ? 'bg-niti-forest text-white shadow-md shadow-niti-forest/20' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {lang === 'hi' ? '⭐ सर्वश्रेष्ठ मेल' : '⭐ Best Match'}
          </button>
          <button
            onClick={() => setFilter('price')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'price' 
                ? 'bg-niti-forest text-white shadow-md shadow-niti-forest/20' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {lang === 'hi' ? '💰 सबसे कम कीमत' : '💰 Lowest Price'}
          </button>
          <button
            onClick={() => setFilter('rating')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'rating' 
                ? 'bg-niti-forest text-white shadow-md shadow-niti-forest/20' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {lang === 'hi' ? '✨ उच्च रेटिंग' : '✨ Top Rated'}
          </button>
          <button
            onClick={() => setFilter('arrival')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === 'arrival' 
                ? 'bg-niti-forest text-white shadow-md shadow-niti-forest/20' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {lang === 'hi' ? '⚡ सबसे जल्दी' : '⚡ Earliest Arrival'}
          </button>
        </div>
      </div>

      {/* Voice Offer Explanation Banner */}
      <div className="bg-gradient-to-r from-niti-mint via-white to-niti-mint/50 border border-niti-forest/20 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-niti-forest text-white flex items-center justify-center shrink-0 shadow-lg shadow-niti-forest/20">
              <Mic className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-niti-forest text-white uppercase tracking-wider">
                  {lang === 'hi' ? 'NITI आवाज़ सहायक' : 'NITI Voice Assistant'}
                </span>
                <span className="text-xs text-gray-500">
                  {lang === 'hi' ? 'सरल भाषा में अंतर समझें' : 'Natural Audio Comparison'}
                </span>
              </div>
              <p className="text-sm md:text-base font-semibold text-gray-800 mt-1">
                {lang === 'hi' 
                  ? '“दोनों मशीनों के दाम और सुविधाओं में क्या अंतर है?” — बोलकर पूछें'
                  : '“What is the difference between these two offers?” — Ask in simple terms'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isPlayingAudio ? (
              <button
                onClick={stopSpeaking}
                className="px-4 py-2.5 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <VolumeX className="w-4 h-4" />
                <span>{lang === 'hi' ? 'आवाज़ रोकें' : 'Stop Audio'}</span>
              </button>
            ) : null}

            <button
              onClick={handleVoiceCompare}
              disabled={isExplaining || selectedForComparison.length < 2}
              className="px-5 py-2.5 rounded-xl bg-niti-forest hover:bg-niti-moss text-white text-xs md:text-sm font-bold shadow-md shadow-niti-forest/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isExplaining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{lang === 'hi' ? 'विश्लेषण जारी...' : 'Analyzing Offers...'}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {lang === 'hi' ? 'ऑफ़र का अंतर बोलकर सुनें' : 'Listen to Voice Comparison'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Display Voice Explanation Box if Generated */}
        {voiceExplanation && (
          <div className="mt-4 pt-4 border-t border-niti-forest/15 animate-fade-in">
            <div className="p-4 rounded-2xl bg-white/90 border border-niti-forest/20 shadow-sm flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-niti-leaf shrink-0 mt-0.5" />
              <div className="text-sm text-gray-800 space-y-2">
                <p className="font-medium leading-relaxed">
                  {voiceExplanation.explanation_text}
                </p>
                {voiceExplanation.difference_amount !== undefined && (
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-niti-forest pt-1">
                    <span className="px-2 py-1 rounded bg-niti-mint">
                      {lang === 'hi' ? `लागत अंतर: ₹${voiceExplanation.difference_amount}` : `Cost Difference: ₹${voiceExplanation.difference_amount}`}
                    </span>
                    <span className="px-2 py-1 rounded bg-niti-mint">
                      {lang === 'hi' ? `सफर का समय: ~${voiceExplanation.arrival_difference_minutes || 15} मिनट अंतर` : `Arrival diff: ~${voiceExplanation.arrival_difference_minutes || 15} mins`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fair Comparison Guidance Note */}
      <div className="flex items-center gap-2 text-xs text-gray-500 px-2">
        <Info className="w-4 h-4 text-niti-forest shrink-0" />
        <span>
          {lang === 'hi' 
            ? 'नीचे दिए गए सभी दाम प्रति एकड़ और कुल खेत आकार के लिए पारदर्शी हैं। कोई छिपा हुआ शुल्क नहीं।' 
            : 'All prices normalized per acre and calculated for your exact field acreage. No hidden charges.'}
        </span>
      </div>

      {/* Offer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedOffers.map((offer, index) => {
          const isSelected = selectedForComparison.includes(offer.offer_id);
          const isBestValue = index === 0;

          return (
            <div
              key={offer.offer_id}
              className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border transition-all relative flex flex-col justify-between ${
                isSelected 
                  ? 'border-niti-forest ring-2 ring-niti-forest/20 shadow-lg' 
                  : 'border-gray-200 hover:border-niti-forest/50'
              }`}
            >
              {/* Badge Top */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  {isBestValue && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-niti-forest text-white">
                      {lang === 'hi' ? 'उत्कृष्ट विकल्प' : 'Best Overall'}
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectForComparison(offer.offer_id)}
                    className="rounded text-niti-forest focus:ring-niti-forest w-4 h-4"
                  />
                  <span>{lang === 'hi' ? 'तुलना में शामिल' : 'Compare'}</span>
                </label>
              </div>

              <div>
                {/* Provider & Machine Name */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-niti-mint/70 border border-niti-forest/15 flex items-center justify-center text-niti-forest shrink-0">
                    <Tractor className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 truncate">
                      {offer.machine_name}
                    </h3>
                    <p className="text-xs text-gray-500 truncate font-medium">
                      {offer.chc_name}
                    </p>
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold mt-1">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{offer.rating || '4.5'}</span>
                      <span className="text-gray-400 font-normal">
                        ({offer.review_count || 18} {lang === 'hi' ? 'समीक्षाएं' : 'reviews'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price Display */}
                <div className="mt-5 p-3.5 rounded-2xl bg-niti-mint/30 border border-niti-forest/10 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-niti-forest">
                      ₹{offer.total_price}
                    </span>
                    <span className="text-xs text-gray-500 ml-1.5 font-medium">
                      {lang === 'hi' ? 'कुल लागत' : 'Total Cost'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-700">
                      ₹{offer.rate_per_acre}
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      {lang === 'hi' ? 'प्रति एकड़' : 'per acre'}
                    </span>
                  </div>
                </div>

                {/* Travel & Time Details */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{offer.distance_km || 4.2} km {lang === 'hi' ? 'दूरी' : 'away'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50">
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>~{offer.estimated_arrival_minutes || 25} {lang === 'hi' ? 'मिनट आगमन' : 'mins ETA'}</span>
                  </div>
                </div>

                {/* Inclusions Tags */}
                <div className="mt-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    {lang === 'hi' ? 'शामिल सुविधाएं (Inclusions)' : 'Included Services'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {offer.includes_operator !== false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <UserCheck className="w-3 h-3" />
                        {lang === 'hi' ? 'कुशल चालक शामिल' : 'Operator Included'}
                      </span>
                    )}
                    {offer.includes_fuel !== false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Fuel className="w-3 h-3" />
                        {lang === 'hi' ? 'डीजल/ईंधन शामिल' : 'Fuel Included'}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      <Truck className="w-3 h-3" />
                      {offer.free_transportation ? (lang === 'hi' ? 'निःशुल्क परिवहन' : 'Free Transport') : `+₹${offer.transportation_fee || 150} ${lang === 'hi' ? 'ढुलाई' : 'Transit'}`}
                    </span>
                  </div>
                </div>

                {/* Terms */}
                <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-niti-forest shrink-0" />
                  <span>
                    {offer.cancellation_terms || (lang === 'hi' ? 'काम से 2 घंटे पहले तक निःशुल्क रद्दीकरण' : 'Free cancellation up to 2h prior')}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => onSelectOffer(offer)}
                  className="w-full py-3 rounded-xl bg-niti-forest hover:bg-niti-moss text-white text-xs md:text-sm font-bold shadow-md shadow-niti-forest/20 flex items-center justify-center gap-1.5 transition-all group"
                >
                  <span>{lang === 'hi' ? 'यह मशीन चुनें व पुष्टि करें' : 'Select & Confirm Booking'}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
