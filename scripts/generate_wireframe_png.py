from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path("design")
OUT.mkdir(exist_ok=True)

W, H = 1240, 900
img = Image.new("RGB", (W, H), "#a90019")
draw = ImageDraw.Draw(img)


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size)


f11 = font(11)
f12 = font(12)
f13 = font(13)
f14 = font(14)
f16 = font(16)
f17 = font(17)
f18 = font(18)
f20 = font(20)
f24b = font(24, True)
f26b = font(26, True)
f28 = font(28)
f34b = font(34, True)
f38b = font(38, True)


def text(x, y, value, fill="#333", f=f16):
    draw.text((x, y), value, fill=fill, font=f)


def rect(x1, y1, x2, y2, fill, outline=None, width=1):
    draw.rectangle((x1, y1, x2, y2), fill=fill, outline=outline, width=width)


def center_text(box, value, f=f16, fill="#3a3a3a"):
    x1, y1, x2, y2 = box
    bbox = draw.textbbox((0, 0), value, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x1 + (x2 - x1 - tw) / 2, y1 + (y2 - y1 - th) / 2), value, fill=fill, font=f)


# Main page
rect(170, 20, 1070, 880, "#f4f4f4")
rect(170, 20, 1070, 130, "#c9c9c9")

text(215, 38, "Оператор · e-commerce CRM", f=f16, fill="#444")
text(215, 68, "Анализ структуры клиентской базы", f=f34b)
for x, label in [(700, "Импорт"), (775, "Аналитика"), (875, "Сегментация"), (995, "Экспорт")]:
    text(x, 55, label, f=f14)

# Import and quality
rect(215, 155, 475, 270, "#c8c8c8")
text(235, 175, "Импорт данных", f=f20)
rect(235, 202, 455, 248, "#eeeeee", outline="#9f9f9f")
center_text((235, 202, 455, 248), "Загрузить Excel-файл", f=f16)
text(242, 252, "возраст · пол · регион · дата · заказы · чек", f=f11, fill="#444")

rect(500, 155, 675, 270, "#c8c8c8")
text(520, 175, "Контроль качества", f=f18)
rect(520, 210, 655, 245, "#eeeeee", outline="#9f9f9f")
center_text((520, 210, 655, 245), "Данные проверены", f=f14)

rect(700, 155, 1025, 270, "#c8c8c8")
text(720, 175, "Сегментация", f=f18)
for i, label in enumerate(["Регион", "Пол", "Возраст", "Заказы", "Средний чек", "Дата"]):
    x = 720 + (i % 3) * 95
    y = 205 + (i // 3) * 34
    rect(x, y, x + 82, y + 24, "#eeeeee", outline="#9f9f9f")
    center_text((x, y, x + 82, y + 24), label, f=f12)

# KPI row
kpis = [
    (215, "Всего", "1000"),
    (350, "Доход", "85k"),
    (485, "Расход", "7k"),
    (620, "Медиана", "66k"),
    (755, "Мода", "1200"),
    (890, "Заказы", "8"),
]
for x, label, value in kpis:
    rect(x, 295, x + 115, 370, "#c8c8c8")
    center_text((x, 302, x + 115, 328), label, f=f15 if 'f15' in globals() else f14)
    center_text((x, 330, x + 115, 360), value, f=f24b)

# Main analytics
rect(215, 400, 555, 575, "#c8c8c8")
text(235, 420, "Возрастные группы", f=f18)
for x, h in [(260, 45), (320, 82), (380, 68), (440, 98), (500, 55)]:
    rect(x, 550 - h, x + 32, 550, "#9f9f9f")
draw.line((245, 550, 535, 550), fill="#777", width=2)
for x, label in [(250, "18-24"), (310, "25-34"), (370, "35-44"), (430, "45-54"), (498, "55+")]:
    text(x, 555, label, f=f11, fill="#444")

rect(585, 400, 800, 575, "#c8c8c8")
text(625, 420, "Распределение по полу", f=f17)
draw.ellipse((635, 455, 745, 565), fill="#a7a7a7")
draw.pieslice((635, 455, 745, 565), start=270, end=90, fill="#8e8e8e")
center_text((635, 455, 745, 565), "50%", f=f24b)

rect(830, 400, 1025, 575, "#c8c8c8")
text(855, 420, "Регионы и доли", f=f17)
for i, row in enumerate(["Москва   10%", "СПб      10%", "Татарстан 10%", "Самара   10%"]):
    y = 455 + i * 28
    rect(850, y, 1005, y + 20, "#eeeeee", outline="#b1b1b1")
    text(858, y + 3, row, f=f12, fill="#444")

rect(215, 605, 555, 765, "#c8c8c8")
text(245, 625, "Регистрации по месяцам", f=f18)
for x, h in [(265, 40), (325, 62), (385, 88), (445, 70), (505, 50)]:
    rect(x, 740 - h, x + 30, 740, "#9f9f9f")
for x, label in [(255, "Янв 24"), (315, "Фев"), (375, "Мар"), (435, "Апр"), (495, "Май")]:
    text(x, 745, label, f=f11, fill="#444")

rect(585, 605, 1025, 765, "#c8c8c8")
text(610, 625, "Карта регионов", f=f18)
draw.polygon([(660, 690), (700, 645), (780, 650), (845, 690), (810, 740), (735, 728), (660, 690)], fill="#aaaaaa", outline="#777")
for cx, cy, r in [(720, 690, 14), (780, 695, 25), (840, 705, 18), (680, 716, 10), (755, 725, 13)]:
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#8d8d8d", outline="#777")
text(895, 660, "Москва", f=f12, fill="#444")
text(895, 688, "СПб", f=f12, fill="#444")
text(895, 716, "Регионы РФ", f=f12, fill="#444")

rect(215, 790, 1025, 835, "#c8c8c8")
text(240, 803, "Сегменты: VIP клиенты · Новые клиенты · Активные · Неактивные", f=f17)

rect(170, 850, 1070, 880, "#c9c9c9")
for x, label in [(215, "Excel"), (285, "KPI"), (350, "Диаграммы"), (455, "Карта регионов"), (600, "Таблица долей"), (900, "прототип проекта")]:
    text(x, 858, label, f=f13)

img.save(OUT / "crm_dashboard_wireframe.png")
print(OUT / "crm_dashboard_wireframe.png")
