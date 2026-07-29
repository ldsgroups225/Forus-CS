import argparse
import json
import math
import os
import subprocess
from pathlib import Path

import pandas as pd


def text(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip()


def items(value):
    return [item.strip() for item in text(value).split(",") if item.strip()]


def number(value):
    try:
        parsed = float(text(value).replace(",", "."))
        return parsed if math.isfinite(parsed) else 0
    except ValueError:
        return 0


def timestamp(value):
    if not text(value):
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return int(parsed.timestamp() * 1000)


def read_rows(path, sheet, header=3):
    frame = pd.read_excel(path, sheet_name=sheet, header=header, dtype=object)
    return frame.where(pd.notna(frame), None).to_dict("records")


def source_portfolios(path):
    result = {}
    for agent in ("Agent 1", "Agent 2", "Agent 3", "Agent 4"):
        for row in read_rows(path, agent, 4):
            phone = text(row.get("Contact transporteur"))
            if phone:
                result[phone] = agent
    return result


def build_payloads(path, limit):
    portfolio_by_phone = source_portfolios(path)
    vehicle_rows = read_rows(path, "Véhicules détaillés")
    owner_id_by_phone = {
        text(row.get("Contact propriétaire")): text(row.get("ID propriétaire"))
        for row in vehicle_rows
        if text(row.get("Contact propriétaire"))
    }
    carriers = []
    for row in read_rows(path, "Transporteurs uniques"):
        phone = text(row.get("Contact transporteur"))
        name = text(row.get("Propriétaire / Transporteur"))
        if not phone or not name:
            continue
        notes = " | ".join(
            value for value in (
                text(row.get("Observations véhicules")),
                text(row.get("Observation")) if text(row.get("Observation")) != "0" else "",
            )
            if value
        )
        carriers.append({
            "name": name,
            "phone": phone,
            "truckTypes": items(row.get("Type(s) de camion")),
            "destinations": items(row.get("Zone(s)")),
            **({"notes": notes} if notes else {}),
            **({"sourcePortfolio": portfolio_by_phone[phone]} if phone in portfolio_by_phone else {}),
            **({"sourceExternalId": owner_id_by_phone[phone]} if owner_id_by_phone.get(phone) else {}),
        })
    if limit:
        carriers = carriers[:limit]
    allowed_phones = {row["phone"] for row in carriers}

    vehicles = []
    driver_context = {}
    for row in vehicle_rows:
        carrier_phone = text(row.get("Contact propriétaire"))
        registration = text(row.get("Immatriculation"))
        if carrier_phone not in allowed_phones or not registration:
            continue
        vehicles.append({
            "registration": registration,
            "truckType": text(row.get("Type de véhicule")) or "Type non renseigné",
            "capacityTons": number(row.get("Tonnage (t)")),
            **({"bodyType": text(row.get("Carrosserie"))} if text(row.get("Carrosserie")) else {}),
            "carrierPhone": carrier_phone,
            "isActive": text(row.get("Actif")).lower() == "oui",
            **({"sourceExternalId": text(row.get("ID propriétaire"))} if text(row.get("ID propriétaire")) else {}),
        })
        driver_phone = text(row.get("Contact chauffeur"))
        if driver_phone:
            context = driver_context.setdefault(driver_phone, {
                "carrierPhone": carrier_phone,
                "registrations": [],
                "sourceExternalId": text(row.get("ID chauffeur")),
            })
            context["registrations"].append(registration)

    drivers = []
    for row in read_rows(path, "Tous les chauffeurs"):
        name = text(row.get("Nom du chauffeur"))
        phone = text(row.get("Contact principal"))
        if not name:
            continue
        context = driver_context.get(phone, {})
        if limit and phone not in driver_context:
            continue
        carrier_phone = context.get("carrierPhone")
        if carrier_phone and carrier_phone not in allowed_phones:
            continue
        driver = {
            "name": name,
            **({"phone": phone} if phone else {}),
            **({"secondaryPhone": text(row.get("Contact secondaire"))} if text(row.get("Contact secondaire")) else {}),
            **({"country": text(row.get("Pays"))} if text(row.get("Pays")) else {}),
            **({"licenseNumber": text(row.get("N° permis"))} if text(row.get("N° permis")) else {}),
            **({"licenseType": text(row.get("Type permis"))} if text(row.get("Type permis")) else {}),
            "isActive": text(row.get("Actif")).lower() == "oui",
            "isArchived": text(row.get("Archivé")).lower() == "oui",
            "vehicleRegistrations": context.get("registrations", items(row.get("Véhicule(s) assigné(s)"))),
            **({"carrierPhone": carrier_phone} if carrier_phone else {}),
            **({"sourceExternalId": context.get("sourceExternalId")} if context.get("sourceExternalId") else {}),
        }
        expires_at = timestamp(row.get("Expiration permis"))
        if expires_at:
            driver["licenseExpiresAt"] = expires_at
        drivers.append(driver)

    return carriers, vehicles, drivers


def send_batches(function_name, organization_slug, import_key, rows, batch_size):
    totals = {"created": 0, "updated": 0}
    for offset in range(0, len(rows), batch_size):
        payload = json.dumps({
            "organizationSlug": organization_slug,
            "importKey": import_key,
            "rows": rows[offset:offset + batch_size],
        }, ensure_ascii=False, separators=(",", ":"))
        result = subprocess.run(
            ["pnpm", "exec", "convex", "run", function_name, payload],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            safe_error = result.stderr.replace(import_key, "[secret masqué]").strip()
            raise RuntimeError(f"{function_name} a échoué : {safe_error}")
        try:
            response = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"{function_name} a retourné une réponse invalide."
            ) from error
        totals["created"] += response["created"]
        totals["updated"] += response["updated"]
    return totals


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--organization", default="forus-group")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.workbook.is_file():
        raise SystemExit("Classeur introuvable.")
    limit = None if args.all else max(1, args.limit)
    carriers, vehicles, drivers = build_payloads(args.workbook, limit)
    summary = {
        "carriers": len(carriers),
        "vehicles": len(vehicles),
        "drivers": len(drivers),
        "mode": "dry-run" if args.dry_run else "import",
    }
    if not args.dry_run:
        import_key = os.environ.get("FORUS_FLEET_IMPORT_KEY")
        if not import_key:
            raise SystemExit(
                "FORUS_FLEET_IMPORT_KEY est requis pour un import effectif."
            )
        summary["carrierResult"] = send_batches(
            "fleetImport:upsertCarriers",
            args.organization,
            import_key,
            carriers,
            args.batch_size,
        )
        summary["vehicleResult"] = send_batches(
            "fleetImport:upsertVehicles",
            args.organization,
            import_key,
            vehicles,
            args.batch_size,
        )
        summary["driverResult"] = send_batches(
            "fleetImport:upsertDrivers",
            args.organization,
            import_key,
            drivers,
            args.batch_size,
        )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
