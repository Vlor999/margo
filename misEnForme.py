import json

def main():
    input_file = "data_transport_commun_grenoble.geojson"
    output_file = "data_transport_commun_grenoble_formate.geojson"
    
    # Lire le fichier
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)  # Charger en tant qu'objet JSON
    
    # Écrire le fichier formaté avec une indentation de 4 espaces
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"Fichier formaté enregistré sous {output_file}")

if __name__ == "__main__":
    main()