import profileData from '../data/profile.json';
import stationsData from '../data/stations.json';

export const SITE_URL = 'https://ham.srinikb.in';

const weatherStation = stationsData.find((s) => s.weatherBeacon) || stationsData[0];

export function personEntity(siteUrl = SITE_URL) {
    return {
        '@type': 'Person',
        '@id': `${siteUrl}/#person`,
        name: profileData.name,
        alternateName: profileData.callsign,
        description: profileData.seo.jobTitle,
        jobTitle: profileData.seo.jobTitle,
        email: profileData.contact.email,
        url: siteUrl,
        sameAs: [
            profileData.qsl.qrzUrl,
            `https://twitter.com/${profileData.social.twitter}`,
            `https://github.com/${profileData.social.github}`,
            profileData.social.professional,
        ].filter(Boolean),
    };
}

export function websiteEntity(siteUrl = SITE_URL) {
    return {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: `${profileData.callsign} Amateur Radio Station`,
        description: profileData.seo.description,
        inLanguage: 'en-IN',
        publisher: { '@id': `${siteUrl}/#person` },
    };
}

export function profilePageEntity(siteUrl = SITE_URL) {
    return {
        '@type': 'ProfilePage',
        '@id': `${siteUrl}/#profile`,
        url: siteUrl,
        name: `${profileData.callsign} Station`,
        description: profileData.seo.description,
        mainEntity: { '@id': `${siteUrl}/#person` },
        knowsAbout: profileData.seo.keywords,
    };
}

export function siteGraph(siteUrl = SITE_URL) {
    return [websiteEntity(siteUrl), personEntity(siteUrl), profilePageEntity(siteUrl)];
}

export function weatherPageSchemas({ siteUrl = SITE_URL, pageUrl, title, description, image }) {
    const stationId = `${pageUrl}#station`;
    const webpageId = `${pageUrl}#webpage`;
    const datasetId = `${pageUrl}#dataset`;

    return [
        {
            '@type': 'WebPage',
            '@id': webpageId,
            url: pageUrl,
            name: title,
            description,
            inLanguage: 'en-IN',
            isPartOf: { '@id': `${siteUrl}/#website` },
            about: { '@id': stationId },
            primaryImageOfPage: image,
            breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: siteUrl,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: 'Weather Station',
                        item: pageUrl,
                    },
                ],
            },
        },
        {
            '@type': 'Place',
            '@id': stationId,
            name: `${profileData.callsign} Weather Station`,
            description:
                'Indoor environmental sensor inside the VU35KB amateur radio shack in Bangalore, India. Readings are not from outside.',
            geo: {
                '@type': 'GeoCoordinates',
                latitude: weatherStation.lat,
                longitude: weatherStation.lon,
                elevation: weatherStation.altitudeM,
            },
            address: {
                '@type': 'PostalAddress',
                addressLocality: weatherStation.name,
                addressRegion: 'Karnataka',
                addressCountry: 'IN',
            },
            additionalProperty: [
                {
                    '@type': 'PropertyValue',
                    name: 'Maidenhead grid square',
                    value: weatherStation.grid,
                },
                {
                    '@type': 'PropertyValue',
                    name: 'Amateur radio callsign',
                    value: profileData.callsign,
                },
                {
                    '@type': 'PropertyValue',
                    name: 'Sensor placement',
                    value: 'Inside the radio shack (indoor, not outdoor)',
                },
                {
                    '@type': 'PropertyValue',
                    name: 'Sensor hardware',
                    value: 'ESP32-S3 Geek with M5Stack ENV III',
                },
            ],
        },
        {
            '@type': 'Dataset',
            '@id': datasetId,
            name: `${profileData.callsign} station weather telemetry`,
            description:
                'Indoor temperature, relative humidity, and barometric pressure inside the shack ENV III sensor, updated every 15 minutes. Not outdoor weather.',
            creator: { '@id': `${siteUrl}/#person` },
            spatialCoverage: { '@id': stationId },
            temporalCoverage: '2026/..',
            measurementTechnique: 'M5Stack ENV III environmental sensor inside shack on ESP32-S3 Geek',
            variableMeasured: [
                'air temperature',
                'relative humidity',
                'barometric pressure',
            ],
            keywords: [
                'amateur radio',
                'weather station',
                profileData.callsign,
                weatherStation.grid,
                'Bangalore',
                'ENV III',
            ],
            isAccessibleForFree: true,
            license: 'https://creativecommons.org/licenses/by/4.0/',
        },
        {
            '@type': 'WebApplication',
            '@id': `${pageUrl}#app`,
            name: title,
            description,
            url: pageUrl,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            browserRequirements: 'Requires JavaScript',
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'INR',
            },
            author: { '@id': `${siteUrl}/#person` },
            about: { '@id': stationId },
            featureList: [
                'Indoor shack temperature, humidity, and pressure',
                '24-hour interactive chart (96 readings at 15-minute intervals)',
                'Derived atmospheric metrics (dew point, heat index, VPD)',
                'Pressure trend and rate-of-change analytics',
            ],
        },
    ];
}
