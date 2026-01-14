CREATE TABLE `guilds` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255) UNIQUE,
  `description` text,
  `owner_user_id` integer COMMENT 'Líder del clan',
  `total_plank_minutes` float DEFAULT 0 COMMENT 'Suma de todos los miembros',
  `total_aura_score` integer DEFAULT 0,
  `member_count` integer DEFAULT 1,
  `created_at` timestamp
);

CREATE TABLE `sessions` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `guild_id` integer COMMENT 'Para saber a qué guild sumó puntos esta sesión',
  `started_at` timestamp,
  `finished_at` timestamp,
  `duration_valid_seconds` integer,
  `plank_earned` decimal,
  `aura_earned` integer,
  `life_minutes_gained` float,
  `device_info` json COMMENT 'Modelo, OS, Acelerómetro data',
  `avg_integrity_score` float,
  `is_verified` boolean DEFAULT false
);

CREATE TABLE `session_proofs` (
  `id` integer PRIMARY KEY,
  `session_id` integer,
  `snapshot_url` varchar(255) COMMENT 'URL a S3 de la foto tomada',
  `ai_confidence_score` float COMMENT 'Qué tan segura está la IA (0.0 - 1.0)',
  `timestamp_in_session` integer COMMENT 'Segundo exacto donde se tomó la foto',
  `created_at` timestamp
);

CREATE TABLE `gyms` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `address` varchar(255),
  `latitude` decimal COMMENT 'Latitud para validación GPS',
  `longitude` decimal COMMENT 'Longitud para validación GPS',
  `qr_code_secret` varchar(255) UNIQUE COMMENT 'Hash que debe contener el QR',
  `reward_aura_fixed` integer DEFAULT 50 COMMENT 'Aura fija por scan',
  `is_active` boolean DEFAULT true,
  `created_at` timestamp
);

CREATE TABLE `gym_checkins` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `gym_id` integer,
  `scanned_at` timestamp COMMENT 'Validar en backend que solo haya uno por día (User-Gym)',
  `user_lat` decimal COMMENT 'Ubicación real capturada al escanear',
  `user_long` decimal COMMENT 'Ubicación real capturada al escanear',
  `transaction_id` integer COMMENT 'Link al ledger para auditoría'
);

CREATE TABLE `transactions` (
  `id` integer PRIMARY KEY,
  `user_id` integer,
  `amount` decimal,
  `currency` ENUM ('PLANK', 'AURA') COMMENT 'PLANK, AURA',
  `type` ENUM ('game_reward', 'guild_bonus', 'shop_purchase', 'withdrawal', 'gym_checkin'),
  `session_id` integer,
  `related_nft_id` integer,
  `tx_hash` varchar(255) COMMENT 'Hash en la blockchain si hubo retiro/mint',
  `created_at` timestamp
);

CREATE TABLE `items_catalog` (
  `id` integer PRIMARY KEY,
  `name` varchar(255),
  `type` ENUM ('character_skin', 'plank_mat', 'aura_effect') COMMENT 'Skin, Badge, Background',
  `cost_plank` decimal,
  `is_nft` boolean DEFAULT true COMMENT 'Si se puede mintear o es solo interno',
  `metadata` json COMMENT 'Atributos para el estándar ERC-721/SPL'
);

CREATE TABLE `user_inventory` (
  `id` integer PRIMARY KEY,
  `user_id` integer,
  `item_id` integer,
  `is_equipped` boolean DEFAULT false,
  `minted_on_chain` boolean DEFAULT false COMMENT 'Si ya se convirtió en NFT real',
  `token_id` varchar(255) COMMENT 'ID del NFT en la blockchain',
  `acquired_at` timestamp
);

ALTER TABLE `users` ADD FOREIGN KEY (`guild_id`) REFERENCES `guilds` (`id`);

ALTER TABLE `guilds` ADD FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`);

ALTER TABLE `sessions` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `sessions` ADD FOREIGN KEY (`guild_id`) REFERENCES `guilds` (`id`);

ALTER TABLE `session_proofs` ADD FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`);

ALTER TABLE `gym_checkins` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `gym_checkins` ADD FOREIGN KEY (`gym_id`) REFERENCES `gyms` (`id`);

ALTER TABLE `gym_checkins` ADD FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`);

ALTER TABLE `transactions` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `transactions` ADD FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`);

ALTER TABLE `user_inventory` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `user_inventory` ADD FOREIGN KEY (`item_id`) REFERENCES `items_catalog` (`id`);
