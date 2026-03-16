# -*- coding: utf-8 -*-
import json
import uuid
import re
import random
from datetime import datetime, timezone

# ------------------------------------------------------------
# 1. ИСХОДНЫЙ ПРАЙС-ЛИСТ (себестоимость, cost)
# ------------------------------------------------------------
ORIGINAL_DATA = """
ASH-002	Go'fra shashka		2 100
ASH-003	Go‘fra shaxmat		5 000
ASH-009	Faner shashka 28 kesilgan 		7 400
ASH-010	Faner shaxmat 28 kesilgan 		9 300
ASH-011	Faner shashka 28 		6 900
ASH-004	Plastmassa shaxmat 20 x 20		8 500
ASH-005	Plastmassa 2 in 1 23 x 23		9 500
ASH-006	Plastmassa 2 in 1 26 x 26		11 400
ASH-007	Plastmassa shaxmat 30 x 30		12 200
ASH-013	Taxta idish 2 in 1 23 x 23		15 900
ASH-014	Taxta idish 2 in 1 28 x 28		22 700
ASH-015	Taxta idish 2 in 1 33 x 33		32 100
ASH-016	Taxta idish 2 in 1 38 x 38		39 900
ASH-017	Taxta idish 2 in 1 43 x 43		46 600
ASH-018	Taxta idish 2 in 1 49 x 49		54 400
AO-020	Kubik LUX		6700
AO-022	Kubik Hayvon		7000
AO-023	Kubik Shakl		7000
AO-037	Kamaz qum		18000
AO-030	Kamaz man + koptok		11500
AO-031	Fura		7300
AO-033	Prado		9600
AO-035	Makvin 31		14400
	Cooper		14500
AO-038	Kema karobkada		4000
AO-110	Badminton		9200
AO-111	Lazer har xil		9800
AO-115	Lazer Shakl		14000
AO-113	Modnitsa OPP		7800
AO-087	Modnitsa PVX		10700
AO-114	Qo'ziqorin puzzle OPP		6000
AO-118	3D Puzzle OPP		6900
AO-119	Chelak nabor		5500
AO-8	Badminton mini		7000
AK-083	PVX plastinka 		8300
AK-084	Plastinka idishli		17100
AK-026	PVX Do'mik		8200
AK-086	Domik shakl idish		17200
AK-078	PVX Burchak shakl		10200
AK-088	Burchak shakl idishli		22000
AK-028	PVX 5 xil Shakl		10500
AK-085	5 xil shakl idishli		22300
AK-090	PVX to'rtburchak		10100
AK-089	To'rtburchak idishli		19900
AK-120	PVX Trubka		10000
AK-121	Idish Trubka		17000
AK-122	PVX Qor parcha		10000
AK-123	Idish Qor parcha		22000
AK-124	PVX Transformer		8000
AK-125	Idish Transformer		22000
AK-126	PVX Malekula		10200
AK-127	Idish Malekula		22200
AK-128	PVX Mazayka		10000
AK-129	Idish Mazayka		22000
AK-029	PVX 7 xil Hayvon		8100
AK-077	PVX Kubik shakl		8400
AK-079	PVX 3D puzzle		8100
AK-080	PVX Qo'ziqo'rin		8100
AK-081	PVX Alifbo		8300
AK-082	PVX kubik hayvonli		8400
AK-130	Karobkali 5 xil Shakl		28500
AK-131	Karobkali Molekula		28500
AK-132	Karobkali  To'rtburchak shakl		28500
AT-072	Fen		1250
AT-001	Hayvon 1 ta		950
AT-068	Hayvon 2 ta		1900
AT-071	Ochkiy		500
AT-056 	Vertalyot katta		1700
AT-044	Fil 		1750
AT-102	Znak 4		700
AT-050 	Znak 		1450
AT-051	Znachok 		900
AT-063	1 ta lapatka 1 ta qolip		850
AT-062 	2 ta lapatka 2 ta qolip 		1650
AT-061	Robot 23		2300
AT-055	Avatar vertalyot		1850
AT-042	Turbo shilaqurt		2100
AT-057	Samalyot		1950
AT-043	Treller 		2100
AT-065	Puzzle kichik 		1400
AT-060	Robot 17		2200
AT-054	Samaliyot kichik		1400
AT-052	Yahta mini 		900
AT-070 	Dazmol 		1400
AT-091	Domik 2		1800
AT-064	Domik 1		900
AT-098	NLO 1 ta 		450
AT-099	NLO 2 ta		900
AT-058	NLO 3 ta 		1350
AT-059	Robot Samuray		1850
AT-040	Ochkiy burun 		1350
AT-100	Ping Pong 1		1050
AT-053	Ping Pong 2		1890
AT-046	Moto odam		
AT-049	Kamaz dog		2200
AT-048	Yahta 		1250
AT-074	Ployka		900
AT-045	Golf car		1950
AT-039	Toychoq 		
AT-041	Toshbaqa		
AT-092	4 xil Buldozer 		1900
AT-093	OPP kema		2100
AT-101	Alifbo 4 talik		800
AT-097	Alifbo 6 talik		1300
AT-073	Alifbo 10 talik		2000
AT-095	Robot 13		1250
AT-096	Hummer		1900
AT-103	Avtobus		3150
AT-104	Prinsessa sumka		1200
AT-106	Dazmol ochkiy		1900
AT-107	Fen ochkiy		1750
AT-108	Prinsessa  ochkiy		1700
AT-109	Ployka ochkiy 		1400
AT-047	Leyka		1180
AT-066	5 xil shakil 8		1040
AT-067	5 xil shakil 16		2080
AT-116	Oyna + Taroq + Zokolka		1900
AT-117	Oyna + Taroq + Zokolka 0,5		950
AT-118	Smart puzzle 1		750
AT-130	Microfon		2100
AT-131	Robot 11 1ta		900
AT-132	Robot 11 2ta		1750
	Болалар стол-стули (комплект)		350 000
	МАК-1 Шаланда		26 700
	МАК-2 Мак		22 300
	МАК-3 Средный		16 800
	МАК-4 Средный шаланда		
	МАК-5 Мини		12 000
	МАК-7 Феррари (889)		26 000
	МАК-8 Феррари (208)		26 000
	МАК-11 Феррари (209)		24 800
	МАК-10 Бугатти		17 300
	МАК-12 Мак Вин (5545)		6 350
	МАК-9 Маленький машина		2 200
	МАК-15 Мерс (1818)		14 300
	МАК-16 Камаз		8 900
	МАК-17 Хаммер		21 000
	МАК-18 Прадо		13 500
	МАК-24 Гоночная машинка		2 500
	МАК-27 Камаз "МАН"		37 000
	МАК-13 Супер Камаз		19 700
	МАК-14 BMW X5		13 400
	МАК-26 Ауди		88 500
	МАК-19 Панда		93 500
	МАК-23 Велосипед		72 600
	МАК-6 Айикча		61 600
	МАК-28 Пикап		98 500
	МАК-29 Тедди		98 500
	МАК-20 Пикап Люкс		135 000
	МАК-21 Тедди Люкс		135 000
	МАК-25 Мега Мак (без Прицеп)		112 400
	МАК-25 Мега Мак (Прицеп)		151 000
	МАК-60 Range Rover (Толокар с ручкой)		145 000
	МАК-61 Range Rover (Толокар без ручки)		113 000
	МАК-30 BMW X6		25 200
	МАК-31 RANGE ROVER		30 000
	МАК-32 PORSCHE		26 200
	МАК-32 PORSCHE POLICE		28 200
	МАК-33 (4х1) Рачок,Кран,Миксер,Цистерна		16 000
	MAK-34 Ferrari		28 200
	MAK-35 BMW M8		26 000
	MAK-36 BUGATTI		30 000
	МАК-37 Миксер (Большой)		20 000
	МАК-38 Цистерна (Большой)		20 000
	МАК-39 Кран (Большой)		20 000
	МАК-40 Рачок (Большой)		20 000
	МАК-41 (6х1) Пожарный,Миксер, Камаз,Рачок, Эвакуатор,Полицейский		12 000
	MAK-42 Rolls-Royce		26 000
	MAK-43 Hummer		29 300
	MAK-45 CADILAC		30 000
	MAK-46 LEXUS		30 000
	MAK-47 AUDI		30 000
	MAK-48 LAND CRAUSER		30 000
	MAK-49 BENTLI		30 000
	MAK-57 MERCEDES BENZ		30 000
	MAK-58 (8x1)		17 000
	MAK-58 (8x1)Коробка		19 000
	MAK-59 Мини набор (22)		45 000
	MAK-59 Мини набор (7)		12 500
	MAK-63 Gelandewagen		37 000
	MAK-64 "Автовоз"(трейлер) с машинками		100 000
	MAK-65		8 000
	MAK-66		8 000
	MAK-67 "Гибрид"		28 000
	MAK-68 "Суперкар"		30 000
	ПЕСОЧНИЦА 2л		10 400
	МАК-72 Игрушки для песочницы		7 500
	Песочница 3		5 000
	Болалар Лейкаси		2 000
	Мак-70 Набор игрушек для песочницы		18 000
	МАК-71 Детская игрушка Самосвал		15 000
	MAK-73		14 000
	MAK-74 Трактор с прицепом		13 000
	MAK-74 голова		6 000
	МАК-75 Толокар (мерс)		140 000
	МАК-76 Толокар Porsche 911		140 000
	МАК-77 Экскаватор (Рачок)		25 000
	МАК-78 Бетономешалка		25 000
	МАК-79 Автокран		25 000
	МАК-80 Автовышка		25 000
	МАК-81 Самосвал		25 000
	МАК-82 Гидромолот		25 000
	МАК-134 Набор игрушек для песочницы		15 000
	МАК-135		12 000
	МАК-136 (кичик)		26 000
	МАК-137 (катта)		32 000
	МАК-170 машинка с амортизаторами (Самосвал)		20 000
	МАК-171 машинка с амортизаторами (Экскаватор)		25 000
	Конструктор 292 (Хэнди)		115 000
	Конструктор 292 (замок)		95 000
	Конструктор 292 (Гранд)		117 000
	Конструктор 292 (Коробка)		100 000
	Пирамида конус (6)		7 000
	Пирамида конус (9)		11 000
	Пирамида конус (12)		17 000
	Пирамида конус (14)		24 000
	MAK-50 Ходинок Лягушка		127 500
	MAK-51 Ходинок Бейби		117 500
	МАК-52 Лего машина маленкий (80)		23 000
	МАК-53 Лего машина большой (129)		36 000
	МАК-54 Лего машина большой (66)		41 000
	МАК-55 Лего (64)		41 500
	МАК-55 Лего (79)		48 000
	МАК-55 Лего (97)		39 000
	МАК-55 Лего (215)		46 000
	МАК-55 Лего (480)		59 000
	MAK-56 LEGO (СУМКА)		42 000
	МАК-42 LEGO (0,5 кг)		17 800
	МАК-42 LEGO (1 кг)		35 500
	Лего контейнер Гранд (128)		65 000
	Лего контейнер Гранд (194)		68 000
	Лего контейнер Гранд (158)		70 000
	Лего Хэнди (56)		35 000
	Лего Хэнди (97)		42 000
	Лего Хэнди (79)		44 000
	Лего Хэнди (112)		60 000
	Лего Хэнди (158)		70 000
	Лего Хэнди (194)		70 000
	LEGO-64 (МИШОК МАЛЕНКЫЙ)		36 000
	LEGO-79 (МИШОК МАЛЕНКЫЙ)		32 000
	LEGO-97 (МИШОК МАЛЕНКЫЙ)		35 000
	LEGO-215 (МИШОК МАЛЕНКЫЙ)		40 000
	LEGO-480 (МИШОК)		49 000
	LEGO-192 (МИШОК )		73 000
	LEGO-237 (МИШОК )		78 000
	LEGO-291 (МИШОК СРЕДНЫЙ)		86 000
	LEGO-645 (МИШОК)		104 000
	LEGO-1440 (МИШОК)		145 000
	LEGO-394 (МИШОК)		170 000
	LEGO-592 (МИШОК)		190 000
	LEGO-484 (МИШОК)		200 000
	LEGO-1300 (МИШОК)		219 000
	LEGO-2890 (МИШОК)		260 000
	LEGO-134 (МИШОК)		65 000
	LEGO-164 (МИШОК)		75 000
	LEGO-204 (МИШОК)		85 000
	LEGO-262 (МИШОК)		110 000
	LEGO-440 (МИШОК)		100 000
	LEGO-970 (МИШОК)		124 000
	LEGO-322 (МИШОК)		135 000
	LEGO-398 (МИШОК)		135 000
	LEGO-870 (МИШОК)		170 000
	LEGO-1930 (МИШОК)		220 000
	Лего Домик мозаика 24		7 000
	Лего мозаика (120) (Контейнер)		36 000
	Лего мозаика (240) Челак		70 000
	Лего мозаика (240)		45 000
	Лего мозаика (486) (Замок)		100 000
	Лего мозаика (720) (Коп)		130 000
	Лего мозаика (970) (Коп)		175 000
	Лего мозаика (1450) (Коп)		270 000
	Лего Патрон (104) (Контейнер)		30 000
	Лего Патрон (130) V (Контейнер)		40 000
	Лего Патрон (260) (Коп)		54 000
	Лего Патрон (260) (Челак)		72 000
	Лего Патрон (530) (Замок)		125 000
	Лего Патрон (780) (Замок)		162 000
	Лего Патрон (1050) (Замок)		240 000
	Лего Патрон (1570) (Замок)		334 000
	LEGO-44 (САВАТЧА)		14 000
	LEGO-111 (САВАТЧА)		18 000
	LEGO-240 (САВАТЧА)		25 000
	LEGO-194 (КОНТЕЙНЕР)		80 000
	Мак-138 Болалар ошхона буюмлари "Чойнак" №1		25 000
	Мак-139 Болалар ошхона буюмлари "Графин" №2		25 000
	Мак-140 Болалар ошхона буюмлари "Газ Плита" №3		28 000
	МАК-141 Болалар ошхона буюмлари "Кичик Пекар" №4		14 000
	МАК-142 Болалар ошхона буюмлари "Мини графин набор " №5		14 000
	Мак-162 Лего (Челак 12л) (177)		70 000
	Мак-162 Лего (Челак 12л) (72)		60 000
	Мак-162 Лего (Челак 12л) (138)		70 000
	Мак-162 Лего (Челак 12л) (312)		100 000
	Мак-162 Лего (Челак 12л) (344)		85 000
	Мак-162 Лего (Челак 12л) (800)		105 000
	Мак-162 Лего (Челак 12л)		-
	Мак-163 Лего Челак 8 л (235)		55 000
	Мак-163 Лего Челак 8 л (107)		47 000
	Мак-163 Лего Челак 8 л (252) мозаика		70 000
	Мак-163 Лего Челак 8 л (560)		65 000
	Мак-163 Лего Челак 8 л (66)		44 000
	Мак-163 Лего Челак 8 л (91)		51 000
	Мак-163 Лего Челак 8 л		-
	МАК-164 Лего Челак 7 л (60)		39 000
	МАК-164 Лего Челак 7 л (73)		45 000
	МАК-164 Лего Челак 7 л (180) Мозаика		55 000
	МАК-164 Лего Челак 7 л (93)		36 000
	МАК-164 Лего Челак 7 л (400)		55 000
	МАК-164 Лего Челак 7 л (205)		45 000
	МАК-164 Лего Челак 7 л		-
	Мак-165 Лего Челак 5,5л (67)		35 000
	Мак-165 Лего Челак 5,5л (360)		47 000
	Мак-165 Лего Челак 5,5л (54)		35 000
	Мак-165 Лего Челак 5,5л (83)		32 000
	Мак-165 Лего Челак 5,5л (185)		42 000
	Мак-165 Лего Челак 5,5л (150) Мозаика		43 000
	Мак-165 Лего Челак 5,5л		-
	Мак-166 Лего Челак 3л (48)		17 500
	Мак-166 Лего Челак 3л (99)		21 000
	Мак-166 Лего Челак 3л (200)		26 500
	Мак-166 Лего Челак 3л (84) Мозаика		23 000
	Мак-166 Лего Челак 3л		-
	Мак-166 Лего Челак 3л		-
	Мак-166 Лего Челак 3л		-
	Мак-167 Лего Челак 2,5л (36)		15 000
	Мак-167 Лего Челак 2,5л (66) мозаика		20 000
	Мак-167 Лего Челак 2,5л (82)		18 000
	Мак-167 Лего Челак 2,5л (160)		22 000
	Мак-167 Лего Челак 2,5л ()		-
	Мак-167 Лего Челак 2,5л ()		-
	Мак-167 Лего Челак 2,5л ()		-
	МAK-168 Лего Челак 1,3л (24)		10 500
	МAK-168 Лего Челак 1,3л (30)мозаика		12 000
	МAK-168 Лего Челак 1,3л (50)		12 000
	МAK-168 Лего Челак 1,3л (80)		13 000
	МAK-168 Лего Челак 1,3л (80)		-
	МAK-168 Лего Челак 1,3л (80)		-
	МAK-168 Лего Челак 1,3л (80)		-
"""

# ------------------------------------------------------------
# 2. НОВЫЙ ПРАЙС-ЛИСТ (розничные цены, price)
# ------------------------------------------------------------
PRICE_DATA = """
AT-072	Fen		1400
AT-001	Hayvon 1 ta		1000
AT-068	Hayvon 2 ta		2000
AT-071	Ochkiy		550
AT-056 	Vertalyot katta		1850
AT-044	Fil 		1800
AT-102	Znak 4		750
AT-050 	Znak 		1500
AT-051	Znachok 		950
AT-063	1 ta lapatka 1 ta qolip		900
AT-062 	"2 ta lapatka 2 ta 
qolip "		1750
AT-061	Robot 23		2400
AT-055	Avatar vertalyot		1900
AT-042	Turbo shilaqurt		2250
AT-057	Samalyot		2100
AT-043	Treller 		2300
AT-065	Puzzle kichik 		1500
AT-060	Robot 17		2300
AT-054	Samaliyot kichik		1500
AT-052	Yahta mini 		950
AT-070 	Dazmol 		1500
AT-091	Domik 2		1900
AT-064	Domik 1		950
AT-098	NLO 1 ta 		500
AT-099	NLO 2 ta		1000
AT-058	NLO 3 ta 		1450
AT-059	Robot Samuray		2000
AT-040	Ochkiy burun 		1400
AT-100	Ping Pong 1		1100
AT-053	Ping Pong 2		2000
AT-046	Moto odam		
AT-049	Kamaz dog		2400
AT-048	Yahta 		1300
AT-074	Ployka		950
AT-045	Golf car		2100
AT-039	Toychoq 		
AT-041	Toshbaqa		
AT-092	4 xil Buldozer 		2000
AT-093	OPP kema		2200
AT-101	Alifbo 4 talik		850
AT-097	Alifbo 6 talik		1400
AT-073	Alifbo 10 talik		2200
AT-095	Robot 13		1300
AT-096	Hummer		2000
AT-103	Avtobus		3200
AT-104	Prinsessa sumka		1300
AT-106	Dazmol ochkiy		2150
AT-107	Fen ochkiy		1900
AT-108	Prinsessa  ochkiy		1800
AT-109	Ployka ochkiy 		1500
AT-047	Leyka		1250
AT-066	5 xil shakil 8		1150
AT-067	5 xil shakil 16		2250
AT-116	Oyna + Taroq + Zokolka		2000
AT-117	Oyna + Taroq + Zokolka 0,5		1000
AT-118	Smart puzzle 1		750
AT-130	Microfon		2200
AT-131	Robot 11 1ta		900
AT-132	Robot 11 2ta		1800
AK-083	PVX plastinka 		9000
AK-084	Plastinka idishli		18000
AK-026	PVX Do'mik		9000
AK-086	Domik shakl idish		18000
AK-078	PVX Burchak shakl		11000
AK-028	PVX 5 xil Shakl		11000
AK-085	5 xil shakl idishli		23000
AK-090	PVX to'rtburchak		11000
AK-089	To'rtburchak idishli		23000
AK-120	PVX Trubka		11000
AK-121	Idish Trubka		18000
AK-122	PVX Qor parcha		11000
AK-123	Idish Qor parcha		23000
AK-124	PVX Transformer		9000
AK-125	Idish Transformer		23000
AK-126	PVX Molekula		11000
AK-127	Idish Molekula		23000
AK-128	PVX Mazayka		11000
AK-129	Idish Mazayka		23000
AK-029	PVX 7 xil Hayvon		9000
AK-081	PVX Alifbo		9000
AK-130	Karobkali 5 xil Shakl		30000
AK-131	Karobkali Molekula		30000
AK-132	Karobkali  To'rtburchak shakl		30000
AO-020	Kubik LUX		7400
AO-022	Kubik Hayvon		7500
AO-023	Kubik Shakl		7500
AO-037	Kamaz qum		19000
AO-030	"Kamaz man + 
koptok"		12000
AO-031	Fura		7800
AO-033	Prado		10000
AO-035	Makvin 31		15000
AO-038	Kema karobkada		4500
AO-110	Badminton		10000
AO-111	Lazer har xil		11000
AO-115	Lazer Shakl		15000
AO-113	Modnitsa OPP		7500
AO-087	Modnitsa PVX		11500
AO-114	"Qo'ziqorin puzzle
OPP"		6600
AO-118	3D Puzzle OPP		7400
AO-119	Chelak nabor		6000
AO-8	Badminton mini		
ASH-002	Go'fra shashka		2 200
ASH-003	"Go‘fra shaxmat
kotta "		5 500
ASH-009	Faner shashka 28 kesilgan 		8 000
ASH-010	Faner shaxmat 28 kesilgan 		10 000
ASH-011	Faner shashka 28 		7 500
ASH-004	Plastmassa 2 in 1 20 x 20		10 000
ASH-005	Plastmassa 2 in 1 23 x 23		11 000
ASH-006	Plastmassa 2 in 1 26 x 26		12 000
ASH-007	Plastmassa 2 in 1 30 x 30		13 000
ASH-013	Taxta idish 2 in 1 23 x 23		17 000
ASH-014	Taxta idish 2 in 1 28 x 28		24 000
ASH-015	Taxta idish 2 in 1 33 x 33		34 000
ASH-016	Taxta idish 2 in 1 38 x 38		42 000
ASH-017	Taxta idish 2 in 1 43 x 43		49 000
ASH-018	Taxta idish 2 in 1 49 x 49		57 000
"""

# ------------------------------------------------------------
# 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ------------------------------------------------------------
def clean_number(s):
    """Преобразует строку вида '2 100', '2 100', '1400' в целое число."""
    if not s or s == '-':
        return 0
    cleaned = re.sub(r'[^\d]', '', str(s))
    return int(cleaned) if cleaned else 0

def parse_product_line(line):
    """Разбирает строку из исходного прайса: артикул, название, себестоимость."""
    line = line.strip()
    if not line or line.startswith('так первый'):
        return None
    parts = [p for p in line.split('\t') if p.strip() != '']
    if not parts:
        return None

    # Последняя часть — цена
    cost_str = parts[-1]
    cost = clean_number(cost_str)

    first_part = parts[0]

    # Проверяем, начинается ли первый токен с артикула (MAK-, МАК-, LEGO- и т.п.)
    if (re.match(r'^[A-ZА-Я]{2,}-\d+', first_part) or 
        first_part.startswith(('MAK-','МАК-','LEGO-','Мак-','MAK '))):
        # Артикул — всё до первого пробела
        if ' ' in first_part:
            article, name_start = first_part.split(' ', 1)
        else:
            article = first_part
            name_start = ''
        # Остальные части (между первым и последним) + начало названия
        name_parts = [name_start] + parts[1:-1]
        name = ' '.join(name_parts).strip()
    else:
        # Нет артикула — всё до последней части — название
        article = ''
        name_parts = parts[:-1]
        name = ' '.join(name_parts).strip()

    return {'article': article, 'name': name, 'cost': cost}

def parse_price_line(line):
    """Разбирает строку из нового прайс-листа: артикул и цена."""
    line = line.strip()
    if not line:
        return None
    parts = [p for p in line.split('\t') if p.strip() != '']
    if len(parts) < 2:
        return None
    article = parts[0]
    price_str = parts[-1]
    price = clean_number(price_str)
    if price == 0 and price_str.strip() not in ('0', ''):
        return None
    return {'article': article, 'price': price}

# ------------------------------------------------------------
# 4. ЗАГРУЗКА ЦЕН ИЗ НОВОГО ПРАЙСА
# ------------------------------------------------------------
price_dict = {}
for line in PRICE_DATA.splitlines():
    item = parse_price_line(line)
    if item and item['article']:
        price_dict[item['article']] = item['price']

# ------------------------------------------------------------
# 5. ГЕНЕРАЦИЯ MongoDB ObjectId (без pymongo)
# ------------------------------------------------------------
def generate_objectid():
    import random, time
    timestamp = hex(int(time.time()))[2:].zfill(8)
    random_part = ''.join(random.choices('0123456789abcdef', k=16))
    return timestamp + random_part

# ------------------------------------------------------------
# 6. ОСНОВНОЙ ЦИКЛ ОБРАБОТКИ
# ------------------------------------------------------------
products = []
for line in ORIGINAL_DATA.splitlines():
    prod = parse_product_line(line)
    if not prod:
        continue

    article = prod['article']
    cost = prod['cost']

    # Определяем тип товара
    if article and article.upper().startswith('A'):
        type_ = 'akitoy'
    else:
        type_ = 'makplast'

    # Цена:
    if type_ == 'akitoy':
        price = price_dict.get(article, 0)
    else:  # makplast – себестоимость + 10%
        price = int(round(cost * 1.1)) if cost > 0 else 0

    min_stock = random.randint(30, 40)
    object_id = generate_objectid()
    uuid_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

    doc = {
        "_id": {"$oid": object_id},
        "id": uuid_id,
        "name": prod['name'],
        "article": article,
        "category": "",
        "type": type_,
        "stock": 0,
        "cost": cost,
        "price": price,
        "description": "",
        "minStock": min_stock,
        "image": "",
        "createdAt": now,
        "updatedAt": now
    }
    products.append(doc)

# ------------------------------------------------------------
# 7. ВЫВОД JSON В ФАЙЛ
# ------------------------------------------------------------
output_file = "mongo_products.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"✅ Обработано товаров: {len(products)}")
print(f"📁 JSON сохранён в файл: {output_file}")
if products:
    print("   Первые 2 записи для проверки:")
    print(json.dumps(products[:2], ensure_ascii=False, indent=2))