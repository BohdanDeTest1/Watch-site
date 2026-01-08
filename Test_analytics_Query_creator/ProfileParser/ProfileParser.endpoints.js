// ProfileParser.endpoints.js
// Fill real endpoints here (leave empty strings if not configured yet).
// Use [profile_name] placeholder - it will be replaced with the entered profile name.

(function () {
    'use strict';

    window.PP_ENDPOINTS = {
        stage: {
            state: 'https://static.ttstage-ext.net/data/travel_town/testing-[profile_name]-all.json',
            liveops: 'https://profile-provider-v2-service.ttstage-int.net/stage/internal-api/v2/config/profiles/[profile_name]/liveops',
            promos: 'https://profile-provider-v2-service.ttstage-int.net/stage/internal-api/v2/config/profiles/[profile_name]/promotionsScheduleNew',

            // [ADMIN] holders (Demo OFF only). Fill later.
            // Use [item_id] placeholder (id of event/promotion).
            adminLiveops: '',
            adminPromos: ''
        },
        rc: {
            state: 'https://static.ttrc-ext.net/data/travel_town/testing-[profile_name]-all.json',
            liveops: 'https://profile-provider-v2-service.ttstage-int.net/od-rc/internal-api/v2/config/profiles/[profile_name]/liveops',
            promos: 'https://profile-provider-v2-service.ttstage-int.net/od-rc/internal-api/v2/config/profiles/[profile_name]/promotionsScheduleNew',

            // [ADMIN] holders (Demo OFF only). Fill later.
            adminLiveops: '',
            adminPromos: ''
        },
        prod: {
            // PROD — ничего не добавляем, кнопку скрываем на UI уровне
            state: '',
            liveops: '',
            promos: ''
        }
    };

})();
