// Wort-Wörterbuch für Branchen: erster Eintrag = deutsche Anzeigeform, danach
// türkische/englische Varianten (inkl. typischer türkischer Endungen wie
// "üretim"/"üretimi"). Übersetzt wird Wort für Wort, sodass auch nicht explizit
// gelistete Kombinationen passen — z. B. "Döner Üretimi" <-> "Döner Produktion"
// oder "Gıda Toptan" <-> "Lebensmittel Großhandel". Unbekannte Wörter (z. B.
// "Döner") bleiben unverändert und werden nur diakritikfrei verglichen.
// Neue Begriffe einfach hier ergänzen.
export const INDUSTRY_TERM_GROUPS: string[][] = [
  ["Produktion", "Herstellung", "Hersteller", "Produzent", "Fertigung", "Üretim", "Üretimi", "Üretici", "Üreticisi", "Üreticileri", "İmalat", "İmalatı", "İmalatçı", "Production", "Manufacturing", "Manufacturer"],
  ["Großhandel", "Grosshandel", "Großhändler", "Toptan", "Toptancı", "Toptancılık", "Toptancısı", "Wholesale"],
  ["Einzelhandel", "Perakende", "Retail"],
  ["Handel", "Händler", "Ticaret", "Ticareti", "Ticari", "Trade", "Trading"],
  ["Lebensmittel", "Nahrungsmittel", "Gıda", "Food"],
  ["Fleisch", "Et", "Meat"],
  ["Geflügel", "Hähnchen", "Tavuk", "Piliç", "Poultry", "Chicken"],
  ["Gastronomie", "Gastronomi", "Gastronomy"],
  ["Restaurant", "Restoran", "Restoranı", "Lokanta", "Lokantası"],
  ["Imbiss", "Büfe", "Büfesi", "Snack"],
  ["Café", "Kafe", "Kafeterya"],
  ["Bäckerei", "Fırın", "Fırını", "Bakery"],
  ["Metzgerei", "Kasap", "Kasabı", "Butcher"],
  ["Catering", "İkram"],
  ["Hotel", "Otel", "Oteli", "Hotellerie"],
  ["Logistik", "Lojistik", "Logistics"],
  ["Transport", "Nakliye", "Nakliyat", "Taşımacılık"],
  ["Vertrieb", "Distribution", "Dağıtım", "Dağıtımı", "Distribütör"],
  ["Lieferant", "Zulieferer", "Tedarik", "Tedarikçi", "Tedarikçisi", "Supplier"],
  ["Import", "İthalat", "İthalatı", "İthalatçı"],
  ["Export", "İhracat", "İhracatı", "İhracatçı"],
  ["Maschinen", "Maschinenbau", "Makine", "Makina", "Makineleri", "Machinery"],
  ["Ausrüstung", "Ekipman", "Ekipmanları", "Equipment"],
  ["Verpackung", "Ambalaj", "Ambalajı", "Packaging"],
  ["Gewürze", "Baharat", "Baharatı", "Spices"],
  ["Getränke", "İçecek", "İçecekleri", "Beverages"],
  ["Tiefkühl", "Tiefkühlkost", "Dondurulmuş", "Frozen"],
  ["Molkerei", "Milchprodukte", "Süt", "Süt Ürünleri", "Dairy"],
  ["Brot", "Ekmek", "Bread"],
  ["Supermarkt", "Süpermarket", "Market", "Supermarket"],
  ["Dienstleistung", "Hizmet", "Hizmetleri", "Service", "Services"],
  ["Branche", "Sektor", "Sektör", "Sektörü", "Sector", "Industry"],
  ["Industrie", "Sanayi", "Sanayii"],
  ["Firma", "Unternehmen", "Şirket", "Şirketi", "Firması", "Company"],
];

// Füllwörter, die beim Vergleich ignoriert werden ("Fleisch und Wurst" == "Et ve Sucuk").
export const INDUSTRY_STOPWORDS = ["und", "ve", "and", "&"];
