PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'anniversary', 'custom')),
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(1,'Wedding Anniversary','anniversary',15,7,2023,NULL,'2026-02-04 06:11:51');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(2,'Civil Marriage','custom',3,6,2023,NULL,'2026-02-04 06:12:51');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(3,'Mum & Pap Anniversary','anniversary',19,10,1991,NULL,'2026-02-04 06:13:59');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(4,'Sacha and Danny First Date','custom',20,12,2020,NULL,'2026-02-04 06:15:00');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(5,'Aadil Johnson','birthday',12,9,1992,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(6,'Alex Hakim','birthday',28,5,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(7,'Andrea Hakim','birthday',19,10,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(8,'Ashleigh Greaves','birthday',11,2,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(9,'Bassel Hammad','birthday',8,4,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(10,'Brando Louca','birthday',17,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(11,'Carl Hakim','birthday',18,11,1994,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(12,'Carmen Alfonso Rico','birthday',2,4,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(13,'Caroline Bayyoud','birthday',5,2,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(14,'Charlotte Geary','birthday',10,1,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(16,'Daniel Weston','birthday',10,8,1992,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(17,'Dany Farha','birthday',21,7,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(18,'Dany Louca','birthday',2,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(19,'Diala Shuhaiber','birthday',28,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(20,'Dimi Abdul Karim','birthday',2,9,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(21,'Emilie Skaff','birthday',18,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(22,'Emilie Spire','birthday',1,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(23,'Gab Lteif','birthday',28,5,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(25,'Gilles Khoury','birthday',30,1,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(26,'Greg Yagan','birthday',7,1,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(28,'Henri Torbey','birthday',3,5,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(29,'Henry Awit','birthday',22,7,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(30,'Hortense Decaux','birthday',31,5,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(31,'Inès Cheaib','birthday',20,9,1992,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(32,'Jad Younes','birthday',24,11,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(33,'James Medler','birthday',9,5,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(34,'Jeddo AbdulKarim','birthday',5,1,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(35,'Joseph Abi-Hanna','birthday',7,3,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(36,'Kaan Giray','birthday',8,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(37,'Kareem Shuhaiber','birthday',24,8,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(38,'Karim Nahas','birthday',19,9,1996,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(39,'Karolina Louca','birthday',28,2,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(40,'Kiki Hakim','birthday',7,5,1992,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(41,'Lena Hakim','birthday',17,4,1966,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(42,'Marc Saade','birthday',2,4,1994,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(43,'Michel Karl Ghossoub','birthday',12,1,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(44,'Mikal Abi ramiah','birthday',27,3,1992,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(45,'Nadine Torbey','birthday',2,3,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(46,'Natalia Ciecierska-Holmes','birthday',23,6,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(47,'Pratik Kabra','birthday',17,10,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(48,'Rami Kalai','birthday',26,8,1995,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(49,'Rami Kanaan','birthday',27,5,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(50,'Sacha Louca','birthday',4,8,1994,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(51,'Sama Assaily','birthday',18,7,2024,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(52,'Samir ICE Hakim','birthday',16,5,1959,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(53,'Scott Warren','birthday',5,9,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(54,'Seb Walker','birthday',5,8,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(55,'Siso Abdel Karim','birthday',17,2,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(56,'Sophie Tollet','birthday',28,6,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(57,'Stefan Mitrasinovic','birthday',31,1,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(58,'Steven Hoyek','birthday',2,2,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(59,'Talyna Louca','birthday',9,2,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(60,'Tania Farha','birthday',4,4,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(61,'Teta AbdulKarim','birthday',2,9,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(62,'Tony Hakim','birthday',27,1,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(63,'Yasmine Farha','birthday',9,10,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(64,'Yasmine Shuhaiber','birthday',3,12,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(65,'Youmna Nahas','birthday',18,1,NULL,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(66,'Yusuf Tayara','birthday',8,10,1995,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(67,'Zoe Geidelberg','birthday',30,5,1993,NULL,'2026-02-04 06:57:14');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(68,'Bass Jirabe','birthday',9,3,1988,NULL,'2026-02-06 09:39:23');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(69,'Ishas Jolly','birthday',1,3,1993,NULL,'2026-03-01 03:25:20');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(70,'Chloe Angel','birthday',20,3,1992,NULL,'2026-03-20 07:27:30');
INSERT INTO "events" ("id","name","type","day","month","year","notes","created_at") VALUES(71,'Maro Farha','birthday',27,7,NULL,NULL,'2026-07-27 08:31:51');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('events',71);
CREATE INDEX idx_events_month_day ON events (month, day);
