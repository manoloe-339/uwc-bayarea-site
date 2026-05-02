-- Optional second alumnus on a news feature, for stories that feature
-- two alumni together (co-founders, joint research, paired interviews,
-- etc.). When set, the homepage byline renders both portraits + names.
ALTER TABLE news_features
  ADD COLUMN IF NOT EXISTS alumni_id_2 INTEGER REFERENCES alumni(id) ON DELETE SET NULL;
