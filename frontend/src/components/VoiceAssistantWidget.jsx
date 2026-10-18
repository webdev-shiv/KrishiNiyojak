import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Volume2, 
  Globe 
} from 'lucide-react';
import { nitiClient } from '../api/nitiClient';
import { machineryService } from '../api/supabaseService';
import { isSupabaseConfigured } from '../api/supabaseClient';

export function VoiceAssistantWidget({ 
  lang = 'hi', 
  onOffersFound, 
  farmerProfile, 
  onOpenManualForm 
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [parseResult, setParseResult] = useState(null);
  const [selectedLang, setSelectedLang] = useState(lang === 'en' ? 'en' : 'hi');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLang === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        setInputText(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMsg(selectedLang === 'hi' ? 'माइक की अनुमति नहीं मिली। कृपया नीचे लिखकर बताएं।' : 'Microphone permission denied. Please type below.');
        } else if (event.error !== 'no-speech') {
          setErrorMsg(selectedLang === 'hi' ? 'आवाज पहचानने में समस्या हुई। पुनः प्रयास करें।' : 'Speech recognition issue. Please try again or type.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [selectedLang]);

  const toggleListening = () => {
    if (!speechSupported) {
      setErrorMsg(selectedLang === 'hi' ? 'आपके ब्राउज़र में वॉइस सपोर्ट उपलब्ध नहीं है। नीचे टाइप करें।' : 'Speech recognition not supported in this browser. Please type below.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
      if (transcript.trim()) {
        handleProcessSpeech(transcript);
      }
    } else {
      setTranscript('');
      setErrorMsg('');
      try {
        recognitionRef.current.lang = selectedLang === 'hi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const handleProcessSpeech = async (textToProcess) => {
    const text = textToProcess || inputText || transcript;
    if (!text.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await nitiClient.parseVoiceTranscript(text, selectedLang);
      setParseResult(data);

      if (window.speechSynthesis && data.follow_up_prompt) {
        const utterance = new SpeechSynthesisUtterance(selectedLang === 'hi' ? data.follow_up_prompt : data.follow_up_prompt_en);
        utterance.lang = selectedLang === 'hi' ? 'hi-IN' : 'en-IN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to parse request');
    } finally {
      setLoading(false);
    }
  };

  const handleFindMachines = async () => {
    const query = inputText.trim() || transcript.trim();
    if (!query) {
      setErrorMsg(selectedLang === 'hi' ? 'कृपया बोलकर या लिखकर अपनी आवश्यकता बताएं।' : 'Please speak or type your requirement.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. NLP Parse query
      const nlpData = await nitiClient.parseVoiceTranscript(query, selectedLang);
      setParseResult(nlpData);

      const ext = nlpData.extracted || {};
      const searchParams = {
        operation: ext.operation || 'HARVESTING',
        machine_type: ext.operation === 'PLOUGHING' ? 'TRACTOR' : 'HARVESTER',
        crop: ext.crop || 'Wheat',
        farm_area: parseFloat(ext.acreage) || 5.0,
        field_location: farmerProfile?.village 
          ? `${farmerProfile.village}, ${farmerProfile.district || 'Uttar Pradesh'}` 
          : (farmerProfile?.district ? `${farmerProfile.district}, Uttar Pradesh` : 'Uttar Pradesh'),
        preferred_date: ext.preferred_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        preferred_time: ext.start_time || '08:00',
        latitude: farmerProfile?.latitude || 26.8467,
        longitude: farmerProfile?.longitude || 80.9462,
      };

      let offers = [];
      let totalMatching = 0;
      const isConfig = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : Boolean(isSupabaseConfigured);
      if (isConfig) {
        try {
          const machines = await machineryService.getAvailableMachinery({
            category: searchParams.machine_type
          });
          if (machines && machines.length > 0) {
            offers = machines.slice(0, 8).map((m) => {
              const rate = m.rate != null ? m.rate : (m.hourly_rate_inr != null ? m.hourly_rate_inr : (m.rate_per_acre_inr != null ? m.rate_per_acre_inr : 0));
              const farmArea = searchParams.farm_area;
              const totalEst = rate > 0 ? (m.rate_unit === 'Acre' ? rate * farmArea : rate * 4) : 0;
              return {
                offer_id: m.id,
                machine_id: m.id,
                chc_id: m.centre_id,
                machine_name: m.name,
                chc_name: m.centres?.name || 'Local CHC Hub',
                total_price: totalEst,
                rate_per_acre: m.rate_unit === 'Acre' ? rate : (rate ? Math.round(rate * 1.25) : 0),
                rate_per_hour: m.rate_unit === 'Hour' ? rate : (rate ? Math.round(rate * 0.8) : 0),
                rating: m.rating || m.farmer_rating || null,
                reviews_count: m.reviews_count || 0,
                estimated_arrival_minutes: null,
                includes_operator: m.operator_included !== false,
                includes_fuel: m.fuel_included !== false,
                horsepower: m.horsepower || null,
                distance_km: null,
              };
            });
            totalMatching = machines.length;
          }
        } catch (dbErr) {
          console.warn('[VoiceAssistant] Direct Supabase machinery search warning:', dbErr);
        }
      }

      if (offers.length === 0) {
        try {
          const result = await nitiClient.searchOffers(searchParams);
          offers = result?.offers || [];
          totalMatching = result?.total_offers_found ?? result?.total_matching ?? offers.length;
        } catch (apiErr) {
          console.warn('[VoiceAssistant] nitiClient searchOffers warning:', apiErr);
        }
      }

      const totalAvailable = totalMatching > 0 ? totalMatching : offers.length;

      if (offers.length > 0) {
        if (onOffersFound) {
          onOffersFound({
            offers,
            requestDetails: searchParams,
            totalAvailable,
          });
        }
      } else {
        setErrorMsg(
          selectedLang === 'hi' 
            ? 'इस आवश्यकता के लिए कोई मशीन उपलब्ध नहीं मिली। कृपया फ़िल्टर बदलें।' 
            : 'No matching machines currently available for this requirement. Please adjust specifications.'
        );
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to search available machine offers');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleChipClick = (chipText) => {
    setInputText(chipText);
    setTranscript(chipText);
    handleProcessSpeech(chipText);
  };

  return (
    <div className="relative bg-[#edf7ee] rounded-3xl p-5 md:p-7 border border-[#cbe8cf] shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left: Glowing Microphone Button */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex items-center justify-center">
            {/* Audio Waveform Bars Left */}
            <div className="flex items-center gap-1 mr-3">
              <span className={`w-1 rounded-full bg-[#1b6b3e] transition-all ${isListening ? 'h-7 animate-pulse' : 'h-3 opacity-40'}`} />
              <span className={`w-1 rounded-full bg-[#1b6b3e] transition-all ${isListening ? 'h-10 animate-bounce' : 'h-5 opacity-60'}`} />
              <span className={`w-1 rounded-full bg-[#1b6b3e] transition-all ${isListening ? 'h-6 animate-pulse' : 'h-3 opacity-40'}`} />
            </div>

            {/* Glowing Circular Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`w-20 h-20 md:w-22 md:h-22 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl ${
                isListening 
                  ? 'bg-emerald-600 ring-8 ring-emerald-400/40 animate-pulse' 
                  : 'bg-[#134e2e] hover:bg-[#1b6b3e] ring-4 ring-emerald-600/20 shadow-[#134e2e]/25'
              }`}
              title={isListening ? 'Click to stop' : 'Click to speak'}
            >
              {isListening ? (
                <MicOff className="w-9 h-9 animate-bounce text-white" />
              ) : (
                <Mic className="w-9 h-9 text-white" />
              )}
            </button>

            {/* Audio Waveform Bars Right */}
            <div className="flex items-center gap-1 ml-3">
              <span className={`w-1 rounded-full bg-[#1b6b3e] transition-all ${isListening ? 'h-6 animate-pulse' : 'h-3 opacity-40'}`} />
              <span className={`w-1 rounded-full bg-[#1b6b3e] transition-all ${isListening ? 'h-10 animate-bounce' : 'h-5 opacity-60'}`} />
              <span className={`w-1 rounded-full bg-[#1b6b3e] transition-all ${isListening ? 'h-7 animate-pulse' : 'h-3 opacity-40'}`} />
            </div>
          </div>

          <span className="text-xs font-bold text-gray-700 mt-2.5">
            {isListening ? (selectedLang === 'hi' ? 'बोलिए, सुन रहे हैं...' : 'Listening...') : 'Click to Speak'}
          </span>
        </div>

        {/* Center: Search & Text Content */}
        <div className="flex-1 w-full text-center lg:text-left space-y-3">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-snug">
              Aaj khet mein kya kaam karwana hai?
            </h2>
            <p className="text-xs md:text-sm text-gray-600 mt-0.5">
              Bolkar batayein — NITI suitable machines aur offers dhoondhega.
            </p>
          </div>

          {/* Search Input Bar with Language Selector & Find Machines Button */}
          <div className="bg-white rounded-2xl p-1.5 pl-3.5 border border-gray-200/90 shadow-md flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Mic className="w-4 h-4 text-emerald-700 shrink-0" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFindMachines(); }}
              placeholder="Jaise: Mujhe kal 5 acre gehun ki katai ke liye harvester chahiye..."
              className="flex-1 bg-transparent text-xs md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none min-w-[180px] py-1.5"
            />

            {/* Language Selector */}
            <div className="flex items-center gap-1 border-l border-gray-200 pl-2.5 pr-1 py-1 text-xs text-gray-600 shrink-0">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Find Machines Button */}
            <button
              onClick={handleFindMachines}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#134e2e] hover:bg-[#1b6b3e] text-white text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 disabled:opacity-75 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Find Machines</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Example prompt chips */}
          <div className="flex items-center justify-center lg:justify-start gap-1.5 flex-wrap text-[11px] text-gray-500 pt-0.5">
            <span className="font-semibold text-gray-600">Example:</span>
            {[
              'Tractor for field preparation',
              'Harvester for wheat harvesting',
              'Rotavator for 3 acres'
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSampleChipClick(chip)}
                className="px-2.5 py-1 rounded-full bg-white/80 hover:bg-white text-gray-700 border border-gray-200/80 shadow-2xs hover:border-emerald-500 transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Extracted Details Box */}
          {parseResult && (
            <div className="mt-3 p-3.5 rounded-2xl bg-white border border-emerald-400 shadow-sm text-left">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  पहचाना गया अनुरोध (Extracted Request)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {parseResult.is_complete ? 'Complete' : 'Need info'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-1.5 bg-gray-50 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Operation</span>
                  <span className="font-bold text-gray-800">{parseResult.extracted.operation || 'Ploughing'}</span>
                </div>
                <div className="p-1.5 bg-gray-50 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Crop</span>
                  <span className="font-bold text-gray-800">{parseResult.extracted.crop || 'Wheat'}</span>
                </div>
                <div className="p-1.5 bg-gray-50 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Area</span>
                  <span className="font-bold text-gray-800">{parseResult.extracted.acreage || 5} Acres</span>
                </div>
                <div className="p-1.5 bg-gray-50 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">Date</span>
                  <span className="font-bold text-gray-800">{parseResult.extracted.preferred_date || 'Tomorrow'}</span>
                </div>
              </div>

              {parseResult.follow_up_prompt && (
                <div className="mt-2 text-xs text-amber-800 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>{selectedLang === 'hi' ? parseResult.follow_up_prompt : parseResult.follow_up_prompt_en}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Far Right: Framed Farmer Character Portrait */}
        <div className="hidden lg:block shrink-0 relative">
          <div className="w-32 h-36 xl:w-36 xl:h-40 rounded-2xl overflow-hidden border-2 border-white shadow-lg relative bg-emerald-800/10">
            <img 
              src="/assets/farmer-portrait.jpg" 
              alt="Farmer Ramesh" 
              className="w-full h-full object-cover object-top hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white text-center drop-shadow">
              NITI Kisan Sahayak
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
