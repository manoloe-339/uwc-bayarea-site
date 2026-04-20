-- Switch the email logo to the new Bay Area brand lockup.
UPDATE site_settings
SET logo_url = 'https://uwcbayarea.org/uwc-bay-area-logo.png',
    updated_at = NOW();
