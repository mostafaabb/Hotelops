import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const dateAt = (d) => new Date(Math.floor(d / DAY) * DAY + 12 * 3600 * 1000);
const addDays = (base, n) => dateAt(base + n * DAY);
const nightsBetween = (a, b) => Math.max(1, Math.round((b - a) / DAY));
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const round = (n) => Math.round(n * 100) / 100;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const YEAR = new Date().getFullYear();

function generateNumber(prefix, seq) {
  return `${prefix}-${YEAR}-${String(seq).padStart(6, '0')}`;
}

const PASSWORD_HASH = bcrypt.hashSync('Demo123!', 12);

const GUEST_FIRST = ['James', 'Maria', 'Chen', 'Sofia', 'Liam', 'Yuki', 'Omar', 'Elena', 'Mateo', 'Aisha', 'Noah', 'Priya', 'Ethan', 'Chloe', 'Diego', 'Hana', 'Lucas', 'Fatima', 'Leo', 'Ingrid', 'Ravi', 'Tessa', 'Marco', 'Zara', 'Kai'];
const GUEST_LAST = ['Smith', 'Garcia', 'Wang', 'Johnson', 'Tanaka', 'Hassan', 'Kowalski', 'Silva', 'Moreau', 'Okafor', 'Brown', 'Sharma', 'Nguyen', 'Rossi', 'Kim', 'Novak', 'Costa', 'Ali', 'Dubois', 'Ivanov', 'Meyer', 'Larsen', 'Cruz', 'Farah', 'Petrov'];
const NATIONALITIES = ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'AU', 'CA', 'BR', 'AE', 'IN', 'TH', 'ES', 'IT', 'KR'];

async function main() {
  console.log('Seeding HotelOps...');

  // ---- WIPE (dependency order) ----
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.folioEntry.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.roomChangeLog.deleteMany();
  await prisma.roomAssignment.deleteMany();
  await prisma.reservationActivity.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.roomBlock.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.inventoryProduct.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomTypeAmenity.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.seasonalPricing.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.hotelService.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.sequence.deleteMany();

  // ---- ORGANIZATION ----
  const org = await prisma.organization.create({
    data: {
      name: 'HotelOps Demo Group',
      slug: 'hotelops-demo',
      email: 'hello@hotelops.app',
      phone: '+1 555 0100',
      address: '1200 Bay Street, Suite 40',
      timezone: 'UTC',
      currency: 'USD',
    },
  });

  // ---- HOTELS ----
  const hotelDefs = [
    { name: 'Grand Meridian Downtown', slug: 'grand-meridian', city: 'New York', country: 'US', starRating: 5, buildings: 2, floors: 8, roomsPerFloor: 8 },
    { name: 'Azure Bay Resort', slug: 'azure-bay', city: 'Miami', country: 'US', starRating: 4, buildings: 1, floors: 6, roomsPerFloor: 6 },
    { name: 'Metro Suites Central', slug: 'metro-suites', city: 'Chicago', country: 'US', starRating: 3, buildings: 1, floors: 5, roomsPerFloor: 4 },
  ];
  const hotels = [];
  for (const [i, def] of hotelDefs.entries()) {
    const hotel = await prisma.hotel.create({
      data: {
        organizationId: org.id,
        name: def.name,
        slug: def.slug,
        description: `${def.name} - ${def.starRating} star hotel in ${def.city}.`,
        email: `${def.slug}@hotelops.app`,
        phone: `+1 555 01${i}0`,
        address: `100 Main St, ${def.city}`,
        city: def.city,
        country: def.country,
        starRating: def.starRating,
        checkInTime: '15:00',
        checkOutTime: '11:00',
      },
    });
    hotels.push({ ...def, hotel });
  }

  // ---- AMENITIES ----
  const amenityNames = ['Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Mini Bar', 'Room Safe', 'Coffee/Tea Maker', 'Hairdryer', 'Balcony', 'Pool Access', 'Bathtub', 'Kitchenette', 'Breakfast Included'];
  const amenities = [];
  for (const name of amenityNames) {
    amenities.push(await prisma.amenity.create({ data: { organizationId: org.id, name } }));
  }

  // ---- ROOM TYPES ----
  const roomTypeDefs = [
    { name: 'Standard Room', code: 'STD', capacity: 2, adults: 2, children: 1, basePrice: 90, size: 22, bed: '1 Queen Bed', img: ['/images/rooms/std.jpg'], amenityIdx: [0, 1, 2] },
    { name: 'Superior Room', code: 'SUP', capacity: 2, adults: 2, children: 1, basePrice: 120, size: 26, bed: '1 King Bed', img: ['/images/rooms/sup.jpg'], amenityIdx: [0, 1, 2, 5, 6] },
    { name: 'Deluxe Room', code: 'DLX', capacity: 3, adults: 3, children: 1, basePrice: 160, size: 32, bed: '1 King Bed', img: ['/images/rooms/dlx.jpg'], amenityIdx: [0, 1, 2, 3, 5, 6] },
    { name: 'Deluxe Twin', code: 'DXT', capacity: 2, adults: 2, children: 1, basePrice: 170, size: 32, bed: '2 Twin Beds', img: ['/images/rooms/dxt.jpg'], amenityIdx: [0, 1, 2, 4, 6] },
    { name: 'Executive Room', code: 'EXE', capacity: 3, adults: 3, children: 1, basePrice: 210, size: 38, bed: '1 King Bed + Sofa', img: ['/images/rooms/exe.jpg'], amenityIdx: [0, 1, 2, 3, 4, 5, 6] },
    { name: 'Junior Suite', code: 'JSU', capacity: 4, adults: 4, children: 2, basePrice: 280, size: 48, bed: '1 King Bed + Seating', img: ['/images/rooms/jsu.jpg'], amenityIdx: [0, 1, 2, 3, 4, 5, 7, 9] },
    { name: 'Family Suite', code: 'FAM', capacity: 5, adults: 4, children: 3, basePrice: 340, size: 56, bed: '2 Queen Beds', img: ['/images/rooms/fam.jpg'], amenityIdx: [0, 1, 2, 3, 5, 7, 10] },
    { name: 'Presidential Suite', code: 'PRS', capacity: 4, adults: 4, children: 2, basePrice: 480, size: 80, bed: '1 King Bed + Dining', img: ['/images/rooms/prs.jpg'], amenityIdx: [0, 1, 2, 3, 4, 7, 8, 9, 10] },
  ];
  const roomTypes = [];
  for (const def of roomTypeDefs) {
    const rt = await prisma.roomType.create({
      data: {
        organizationId: org.id,
        name: def.name,
        code: def.code,
        description: `${def.name} - ${def.size} m2, sleeps ${def.capacity}.`,
        capacity: def.capacity,
        adultsCapacity: def.adults,
        childrenCapacity: def.children,
        basePrice: def.basePrice,
        size: def.size,
        bedConfiguration: def.bed,
        images: def.img,
        amenities: {
          create: def.amenityIdx.map((i) => ({ amenity: { connect: { id: amenities[i].id } } })),
        },
      },
    });
    roomTypes.push(rt);
  }

  // ---- BUILDINGS, FLOORS, ROOMS ----
  const roomsByHotel = {};
  for (const def of hotels) {
    roomsByHotel[def.hotel.id] = [];
    for (let b = 0; b < def.buildings; b++) {
      const building = await prisma.building.create({
        data: { hotelId: def.hotel.id, name: `${def.hotel.name} Tower ${b + 1}`, code: `${def.hotel.slug}-${String(b + 1).padStart(2, '0')}` },
      });
      for (let f = 1; f <= def.floors; f++) {
        const floor = await prisma.floor.create({
          data: { buildingId: building.id, name: `Floor ${f}`, number: f },
        });
        for (let r = 1; r <= def.roomsPerFloor; r++) {
          const roomNumber = `${String(f).padStart(2, '0')}${String(r).padStart(2, '0')}`;
          const rt = pick(roomTypes);
          const room = await prisma.room.create({
            data: {
              organizationId: org.id,
              hotelId: def.hotel.id,
              buildingId: building.id,
              floorId: floor.id,
              roomTypeId: rt.id,
              roomNumber,
              floorPosition: r,
              status: 'AVAILABLE',
              housekeepingStatus: 'CLEAN',
              maintenanceStatus: 'NONE',
            },
          });
          roomsByHotel[def.hotel.id].push({ room, rt });
        }
      }
    }
  }

  // ---- USERS & STAFF ----
  const departments = [];
  for (const d of ['Front Office', 'Housekeeping', 'Engineering', 'Food & Beverage', 'Sales & Marketing', 'Accounting']) {
    departments.push(await prisma.department.create({ data: { organizationId: org.id, name: d } }));
  }
  const deptByName = Object.fromEntries(departments.map((d) => [d.name, d]));

  const userDefs = [
    { email: 'owner@hotelops.app', firstName: 'Alex', lastName: 'Morgan', role: 'OWNER', hotel: null, dept: 'Front Office', pos: 'Owner & CEO' },
    { email: 'manager@hotelops.app', firstName: 'Taylor', lastName: 'Reed', role: 'GENERAL_MANAGER', hotel: 0, dept: 'Front Office', pos: 'General Manager' },
    { email: 'frontdesk@hotelops.app', firstName: 'Jordan', lastName: 'Lee', role: 'FRONT_DESK', hotel: 0, dept: 'Front Office', pos: 'Front Desk Agent' },
    { email: 'reservations@hotelops.app', firstName: 'Casey', lastName: 'Ng', role: 'RESERVATION_AGENT', hotel: 0, dept: 'Front Office', pos: 'Reservations Agent' },
    { email: 'housekeeping@hotelops.app', firstName: 'Riley', lastName: 'Patel', role: 'HOUSEKEEPING_MANAGER', hotel: 0, dept: 'Housekeeping', pos: 'Housekeeping Supervisor' },
    { email: 'hkstaff@hotelops.app', firstName: 'Sam', lastName: 'Walker', role: 'HOUSEKEEPER', hotel: 0, dept: 'Housekeeping', pos: 'Room Attendant' },
    { email: 'maintenance@hotelops.app', firstName: 'Drew', lastName: 'Kim', role: 'MAINTENANCE_MANAGER', hotel: 0, dept: 'Engineering', pos: 'Chief Engineer' },
    { email: 'maintstaff@hotelops.app', firstName: 'Morgan', lastName: 'Reyes', role: 'MAINTENANCE_STAFF', hotel: 0, dept: 'Engineering', pos: 'Maintenance Technician' },
    { email: 'accountant@hotelops.app', firstName: 'Avery', lastName: 'Stone', role: 'ACCOUNTANT', hotel: 0, dept: 'Accounting', pos: 'Accountant' },
    { email: 'manager2@hotelops.app', firstName: 'Blake', lastName: 'Rivera', role: 'HOTEL_MANAGER', hotel: 1, dept: 'Front Office', pos: 'Hotel Manager' },
    { email: 'fd2@hotelops.app', firstName: 'Quinn', lastName: 'Brooks', role: 'FRONT_DESK', hotel: 1, dept: 'Front Office', pos: 'Front Desk Agent' },
    { email: 'manager3@hotelops.app', firstName: 'Robin', lastName: 'Foster', role: 'HOTEL_MANAGER', hotel: 2, dept: 'Front Office', pos: 'Hotel Manager' },
  ];

  const users = [];
  let empSeq = 1;
  for (const ud of userDefs) {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        hotelId: ud.hotel !== null ? hotels[ud.hotel].hotel.id : null,
        firstName: ud.firstName,
        lastName: ud.lastName,
        email: ud.email,
        passwordHash: PASSWORD_HASH,
        role: ud.role,
        status: 'ACTIVE',
      },
    });
    await prisma.staff.create({
      data: {
        employeeId: `EMP-${YEAR}-${String(empSeq++).padStart(4, '0')}`,
        organizationId: org.id,
        hotelId: ud.hotel !== null ? hotels[ud.hotel].hotel.id : null,
        userId: user.id,
        departmentId: deptByName[ud.dept].id,
        position: ud.pos,
        hireDate: addDays(now, -rnd(200, 900)),
        salary: rnd(45, 140) * 1000,
        salaryVisibleTo: 'OWNER',
        employmentType: 'FULL_TIME',
      },
    });
    users.push(user);
  }
  const userByEmail = Object.fromEntries(users.map((u) => [u.email, u]));

  // ---- RATE PLANS, TAXES, SEASONAL, PROMOS ----
  const ratePlanDefs = [
    { name: 'Non-Refundable', desc: 'Best available rate, non-refundable.', mult: 1.0, ref: false, policy: 'Non-refundable. No modifications.' },
    { name: 'Flexible Rate', desc: 'Free cancellation up to 48h before check-in.', mult: 1.15, ref: true, policy: 'Free cancellation up to 48 hours before arrival.' },
    { name: 'Bed & Breakfast', desc: 'Rate including daily breakfast.', mult: 1.25, ref: true, policy: 'Free cancellation up to 72 hours. Breakfast included.' },
  ];
  const ratePlans = [];
  for (const def of ratePlanDefs) {
    const rp = await prisma.ratePlan.create({
      data: {
        organizationId: org.id,
        name: def.name,
        description: def.desc,
        basePrice: 1,
        cancellationPolicy: def.policy,
        isRefundable: def.ref,
        active: true,
      },
    });
    ratePlans.push({ ...def, rp });
  }

  await prisma.taxRate.createMany({
    data: [
      { organizationId: org.id, name: 'VAT', rate: 10, type: 'PERCENTAGE' },
      { organizationId: org.id, name: 'Tourism Tax', rate: 5, type: 'PERCENTAGE' },
    ],
  });

  await prisma.promoCode.create({
    data: { organizationId: org.id, code: 'WELCOME10', description: '10% off first stay', discountType: 'PERCENTAGE', discountValue: 10, validFrom: addDays(now, -30), validTo: addDays(now, 120), active: true },
  });
  await prisma.promoCode.create({
    data: { organizationId: org.id, code: 'SUMMER50', description: '$50 off stays over $400', discountType: 'FIXED', discountValue: 50, minAmount: 400, validFrom: addDays(now, -15), validTo: addDays(now, 60), active: true },
  });

  await prisma.seasonalPricing.create({
    data: { organizationId: org.id, name: 'Holiday Season', startDate: addDays(now, 60), endDate: addDays(now, 80), adjustmentType: 'PERCENTAGE', adjustment: 20 },
  });

  // ---- HOTEL SERVICES ----
  const serviceDefs = [
    { name: 'Breakfast Buffet', price: 25, tax: 10, cat: 'Dining', desc: 'Full buffet breakfast, 6:30-10:30' },
    { name: 'Airport Transfer', price: 45, tax: 10, cat: 'Transport', desc: 'Private car to/from airport (up to 3 pax)' },
    { name: 'Laundry Service', price: 20, tax: 10, cat: 'Housekeeping', desc: 'Same-day laundry per load' },
    { name: 'Spa Massage (60min)', price: 65, tax: 10, cat: 'Wellness', desc: 'Relaxing full-body massage' },
    { name: 'Dinner at Restaurant', price: 55, tax: 10, cat: 'Dining', desc: 'Set dinner for two' },
    { name: 'Late Checkout (to 6pm)', price: 30, tax: 0, cat: 'Guest Services', desc: 'Keep your room until 6pm' },
  ];
  const services = [];
  for (const s of serviceDefs) {
    const created = await prisma.hotelService.create({
      data: { organizationId: org.id, hotelId: hotels[0].hotel.id, name: s.name, price: s.price, taxRate: s.tax, category: s.cat, description: s.desc, active: true },
    });
    services.push(created);
  }
  for (const s of serviceDefs.slice(0, 4)) {
    await prisma.hotelService.create({
      data: { organizationId: org.id, hotelId: hotels[1].hotel.id, name: s.name, price: s.price, taxRate: s.tax, category: s.cat, active: true },
    });
  }

  // ---- GUESTS ----
  const guests = [];
  const usedEmails = new Set();
  for (let i = 0; i < 110; i++) {
    const first = pick(GUEST_FIRST);
    const last = pick(GUEST_LAST);
    let email = `${first.toLowerCase()}.${last.toLowerCase()}${rnd(1, 99)}@example.com`;
    while (usedEmails.has(email)) email = `${first.toLowerCase()}.${last.toLowerCase()}${rnd(1, 999)}@example.com`;
    usedEmails.add(email);
    const hotel = pick(hotels);
    const vip = i % 9 === 0;
    const guest = await prisma.guest.create({
      data: {
        organizationId: org.id,
        hotelId: vip ? hotels[0].hotel.id : hotel.hotel.id,
        firstName: first,
        lastName: last,
        email,
        phone: `+1 555 2${String(i).padStart(3, '0')}`,
        dateOfBirth: addDays(now, -rnd(7000, 22000)),
        nationality: pick(NATIONALITIES),
        address: `${rnd(10, 9999)} Guest St`,
        city: pick(['New York', 'Los Angeles', 'Chicago', 'Miami', 'Boston']),
        country: 'US',
        idType: vip ? 'Passport' : pick(['Passport', "Driver's License"]),
        idNumber: `ID-${String(i).padStart(6, '0')}`,
        isVip: vip,
        vipLevel: vip ? rnd(1, 3) : 0,
        status: 'ACTIVE',
        gender: pick(['MALE', 'FEMALE', 'OTHER']),
        preferences: vip ? 'Upper floor, quiet room. Extra pillows.' : null,
        specialRequests: i % 5 === 0 ? 'Late check-in request. High floor preferred.' : null,
      },
    });
    guests.push(guest);
  }

  // ---- VENDORS & INVENTORY ----
  const vendorDefs = [
    { name: 'FreshBasket Supply Co', category: 'Food & Beverage', contact: 'Mary Johnson', email: 'orders@freshbasket.test' },
    { name: 'Hotel Linens Direct', category: 'Cleaning', contact: 'Tim Hall', email: 'sales@linensdirect.test' },
    { name: 'AC Repair Pros', category: 'Maintenance', contact: 'Victor Lane', email: 'service@acrepairpros.test' },
    { name: 'Green Office Supplies', category: 'Office', contact: 'Nina Brooks', email: 'info@greenoffice.test' },
  ];
  const vendors = [];
  for (const v of vendorDefs) {
    vendors.push(await prisma.vendor.create({
      data: { organizationId: org.id, hotelId: hotels[0].hotel.id, name: v.name, contactPerson: v.contact, email: v.email, phone: '+1 555 3000', category: v.category, status: 'ACTIVE' },
    }));
  }

  const productDefs = [
    { name: 'Toilet Paper (12-pack)', sku: 'HK-1001', cat: 'Housekeeping', unit: 'pack', min: 30, qty: 80, cost: 6.5 },
    { name: 'Shampoo (50ml)', sku: 'HK-1002', cat: 'Housekeeping', unit: 'pcs', min: 100, qty: 240, cost: 0.9 },
    { name: 'Bath Towel', sku: 'HK-1003', cat: 'Housekeeping', unit: 'pcs', min: 60, qty: 120, cost: 8 },
    { name: 'Bed Sheet Set (King)', sku: 'HK-1004', cat: 'Housekeeping', unit: 'set', min: 40, qty: 75, cost: 22 },
    { name: 'Coffee Capsules', sku: 'FB-2001', cat: 'Food & Beverage', unit: 'box', min: 20, qty: 35, cost: 12 },
    { name: 'Minibar Water', sku: 'FB-2002', cat: 'Food & Beverage', unit: 'pcs', min: 100, qty: 210, cost: 1.1 },
    { name: 'HVAC Air Filter', sku: 'EN-3001', cat: 'Maintenance', unit: 'pcs', min: 15, qty: 9, cost: 18.5 },
    { name: 'Light Bulbs (LED)', sku: 'EN-3002', cat: 'Maintenance', unit: 'box', min: 10, qty: 22, cost: 14 },
    { name: 'Printer Paper', sku: 'OF-4001', cat: 'Office', unit: 'ream', min: 20, qty: 48, cost: 5 },
    { name: 'Detergent (5L)', sku: 'HK-1005', cat: 'Housekeeping', unit: 'jug', min: 10, qty: 4, cost: 16.9 },
  ];
  const products = [];
  for (const p of productDefs) {
    const prod = await prisma.inventoryProduct.create({
      data: {
        organizationId: org.id,
        hotelId: hotels[0].hotel.id,
        name: p.name,
        sku: p.sku,
        category: p.cat,
        quantity: p.qty,
        minimumStock: p.min,
        unit: p.unit,
        cost: p.cost,
        supplier: pick(vendors).name,
        location: pick(['Storage A', 'Storage B', 'Housekeeping Cart', 'Office Closet']),
      },
    });
    products.push(prod);
    const movType = pick(['IN', 'IN', 'IN', 'OUT', 'OUT']);
    const q = rnd(1, 20);
    await prisma.stockMovement.create({
      data: {
        productId: prod.id,
        organizationId: org.id,
        hotelId: hotels[0].hotel.id,
        type: movType,
        quantity: q,
        reason: movType === 'IN' ? 'Purchase order received' : 'Issued to floor',
        performedBy: userByEmail['housekeeping@hotelops.app'].id,
        createdAt: addDays(now, -rnd(1, 40)),
      },
    });
  }

  // ---- EXPENSES ----
  const expenseCats = ['UTILITIES', 'SALARIES', 'MAINTENANCE', 'SUPPLIES', 'MARKETING', 'FOOD_BEVERAGE', 'TRANSPORTATION', 'CLEANING'];
  for (let i = 0; i < 50; i++) {
    const hotel = pick(hotels);
    const cat = pick(expenseCats);
    await prisma.expense.create({
      data: {
        organizationId: org.id,
        hotelId: hotel.hotel.id,
        category: cat,
        amount: rnd(50, 4000) + 0.5,
        description: `${cat.toLowerCase()} expense - ${rnd(1, 99)}`,
        vendorId: i % 3 === 0 ? pick(vendors).id : null,
        date: addDays(now, -rnd(1, 90)),
        paymentMethod: pick(['CASH', 'CREDIT_CARD', 'BANK_TRANSFER']),
        createdBy: userByEmail['accountant@hotelops.app'].id,
      },
    });
  }

  // ---- RESERVATIONS ----
  const sources = ['DIRECT', 'WEBSITE', 'PHONE', 'WALK_IN', 'BOOKING_PLATFORM', 'TRAVEL_AGENT', 'CORPORATE'];
  const occupancy = new Set();
  const canAssign = (hotelId, roomId, checkIn, checkOut) => {
    for (const d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
      const k = `${hotelId}:${roomId}:${d.getTime()}`;
      if (occupancy.has(k)) return false;
    }
    for (const d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
      occupancy.add(`${hotelId}:${roomId}:${d.getTime()}`);
    }
    return true;
  };

  const createdReservations = [];
  let resSeq = 1;
  let folioSeq = 1;

  async function createReservation(o) {
    const hotel = hotels[o.hotelIdx];
    const guest = o.guest;
    const rt = hotel.rooms !== undefined ? o.rt : pick(roomTypes);
    const nights = o.nights;
    const checkIn = o.checkIn;
    const checkOut = addDays(checkIn, nights);
    const basePrice = Number(o.rt?.basePrice ?? rt.basePrice);
    const subtotal = round(basePrice * nights);
    const taxes = round(subtotal * 0.15);
    const total = round(subtotal + taxes);

    let room = null;
    if (o.needRoom) {
      const candidates = hotel.rooms.filter((rr) => rr.rt.id === o.rt.id);
      for (const cand of candidates) {
        if (canAssign(hotel.hotel.id, cand.room.id, checkIn, checkOut)) {
          room = cand;
          break;
        }
      }
    } else {
      for (const cand of hotel.rooms) {
        if (canAssign(hotel.hotel.id, cand.room.id, checkIn, checkOut)) {
          room = cand;
          break;
        }
      }
    }

    const confirmation = generateNumber('HTL', resSeq++);
    const isPaidOut = o.status === 'CHECKED_OUT';
    const paid = o.status === 'CHECKED_IN' ? round(total * 0.4) : isPaidOut ? total : o.status === 'CONFIRMED' && Math.random() < 0.4 ? round(total * 0.3) : 0;
    const balance = round(total - paid);

    const reservation = await prisma.reservation.create({
      data: {
        confirmationNumber: confirmation,
        organizationId: org.id,
        hotelId: hotel.hotel.id,
        guestId: guest.id,
        roomId: room ? room.room.id : null,
        roomTypeId: o.rt.id,
        ratePlanId: pick(ratePlans).rp.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: o.adults,
        children: 0,
        numberOfGuests: o.adults,
        status: o.status,
        source: o.source,
        specialRequests: Math.random() < 0.2 ? 'High floor, quiet room if available.' : null,
        channel: o.source === 'BOOKING_PLATFORM' ? 'Booking.com' : o.source === 'TRAVEL_AGENT' ? 'Local agency' : null,
        bookingReference: o.source === 'BOOKING_PLATFORM' ? `BK-${resSeq}` : null,
        subtotal,
        taxes,
        discounts: 0,
        total,
        amountPaid: paid,
        balance,
        cancelledAt: o.status === 'CANCELLED' ? addDays(checkIn, -rnd(1, 10)) : null,
        cancelReason: o.status === 'CANCELLED' ? pick(['Travel plans changed', 'Found better rate', 'Weather concerns', 'Booking error']) : null,
        checkInAt: o.status === 'CHECKED_IN' ? addDays(checkIn, 0) : o.status === 'CHECKED_OUT' ? addDays(checkIn, 0) : null,
        checkOutAt: o.status === 'CHECKED_OUT' ? addDays(checkIn, nights) : null,
        noShowAt: o.status === 'NO_SHOW' ? addDays(checkIn, 1) : null,
        createdBy: userByEmail['reservations@hotelops.app'].id,
        createdAt: addDays(now, -rnd(1, 60)),
      },
    });

    await prisma.reservationActivity.create({
      data: {
        reservationId: reservation.id,
        type: 'CREATED',
        description: `Reservation ${confirmation} created`,
        performedBy: userByEmail['reservations@hotelops.app'].id,
        performedAt: reservation.createdAt,
      },
    });

    if (room) {
      await prisma.roomAssignment.create({
        data: { reservationId: reservation.id, roomId: room.room.id, assignedBy: userByEmail['reservations@hotelops.app'].id, assignedAt: reservation.createdAt },
      });
      if (o.status === 'CHECKED_IN') {
        await prisma.reservationActivity.create({
          data: { reservationId: reservation.id, type: 'CHECKED_IN', description: `Checked in to room ${room.room.roomNumber}`, performedBy: userByEmail['frontdesk@hotelops.app'].id },
        });
      }
      if (o.status === 'CHECKED_OUT') {
        await prisma.reservationActivity.create({
          data: { reservationId: reservation.id, type: 'CHECKED_OUT', description: `Checked out of room ${room.room.roomNumber}`, performedBy: userByEmail['frontdesk@hotelops.app'].id },
        });
      }
    }
    if (o.status === 'CANCELLED') {
      await prisma.reservationActivity.create({
        data: { reservationId: reservation.id, type: 'CANCELLED', description: 'Reservation cancelled', performedBy: userByEmail['reservations@hotelops.app'].id },
      });
    }

    // Folio + entries for charged stays
    if (o.status === 'CHECKED_IN' || o.status === 'CHECKED_OUT' || (o.status === 'NO_SHOW' && Math.random() < 0.4)) {
      const folio = await prisma.folio.create({
        data: {
          reservationId: reservation.id,
          hotelId: hotel.hotel.id,
          guestId: guest.id,
          paidAmount: paid,
          balance,
        },
      });
      await prisma.folioEntry.create({
        data: { folioId: folio.id, reservationId: reservation.id, type: 'ROOM_CHARGE', description: `Room charge (${nights} night${nights > 1 ? 's' : ''})`, amount: subtotal, taxAmount: 0, quantity: nights, createdBy: userByEmail['frontdesk@hotelops.app'].id },
      });
      await prisma.folioEntry.create({
        data: { folioId: folio.id, reservationId: reservation.id, type: 'TAX', description: 'VAT + Tourism Tax (15%)', amount: taxes, taxAmount: 0, quantity: 1, createdBy: userByEmail['frontdesk@hotelops.app'].id },
      });

      if (Math.random() < 0.25 && o.status !== 'NO_SHOW') {
        const service = pick(services);
        const servicePrice = Number(service.price);
        await prisma.folioEntry.create({
          data: { folioId: folio.id, reservationId: reservation.id, type: 'SERVICE', description: service.name, amount: servicePrice, taxAmount: round(servicePrice * 0.1), quantity: 1, referenceId: service.id, referenceType: 'HotelService', createdBy: userByEmail['frontdesk@hotelops.app'].id },
        });
        const soTotal = round(servicePrice * 1.1);
        await prisma.serviceOrder.create({
          data: {
            organizationId: org.id,
            hotelId: hotel.hotel.id,
            reservationId: reservation.id,
            guestId: guest.id,
            serviceId: service.id,
            quantity: 1,
            unitPrice: servicePrice,
            taxAmount: round(servicePrice * 0.1),
            total: soTotal,
            status: 'DELIVERED',
            requestedTime: addDays(checkIn, 1),
            deliveredTime: addDays(checkIn, 1),
            createdBy: userByEmail['frontdesk@hotelops.app'].id,
          },
        });
      }

      if (paid > 0) {
        await prisma.payment.create({
          data: {
            organizationId: org.id,
            hotelId: hotel.hotel.id,
            reservationId: reservation.id,
            guestId: guest.id,
            folioId: folio.id,
            amount: paid,
            method: pick(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE_PAYMENT']),
            status: 'COMPLETED',
            paymentType: 'PAYMENT',
            reference: `PAY-REF-${rnd(100000, 999999)}`,
            receivedBy: userByEmail['frontdesk@hotelops.app'].id,
            receivedAt: isPaidOut ? addDays(checkIn, nights - 1) : addDays(checkIn, 0),
            notes: null,
          },
        });
      }

      if (o.status === 'CHECKED_OUT') {
        const invSeq = folioSeq++;
        const invoiceNumber = generateNumber('INV', invSeq);
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            organizationId: org.id,
            hotelId: hotel.hotel.id,
            reservationId: reservation.id,
            guestId: guest.id,
            folioId: folio.id,
            status: 'PAID',
            subtotal,
            taxTotal: taxes,
            discountTotal: 0,
            total,
            amountPaid: total,
            balance: 0,
            issuedAt: addDays(checkIn, nights),
            paidAt: addDays(checkIn, nights),
            createdBy: userByEmail['frontdesk@hotelops.app'].id,
          },
        });
        await prisma.invoiceItem.create({
          data: { invoiceId: invoice.id, description: `Room charge (${nights} nights)`, quantity: nights, unitPrice: basePrice, taxAmount: round(basePrice * 0.15), amount: round(basePrice * 1.15) },
        });
        if (Math.random() < 0.25) {
          const service = pick(services);
          const sp = Number(service.price);
          await prisma.invoiceItem.create({
            data: { invoiceId: invoice.id, description: service.name, quantity: 1, unitPrice: sp, taxAmount: round(sp * 0.1), amount: round(sp * 1.1) },
          });
        }
      }
    }

    createdReservations.push(reservation);
    return reservation;
  }

  const hotelRoomCount = hotels.map((d) => d.hotel);

  // Past: checked out / cancelled / no-show
  let count = 0;
  for (let i = 0; i < 110 && count < 160; i++) {
    const hotelIdx = i % hotelDefs.length;
    const pool = roomsByHotel[hotels[hotelIdx].hotel.id];
    if (!pool.length) continue;
    const rt = pick([...new Set(pool.map((r) => r.rt))]);
    const nights = rnd(1, 5);
    const checkIn = addDays(now, -rnd(1, 90) - (nights - 1) * 2);
    const roll = Math.random();
    const status = roll < 0.72 ? 'CHECKED_OUT' : roll < 0.84 ? 'NO_SHOW' : 'CANCELLED';
    await createReservation({
      hotelIdx,
      guest: guests[i % guests.length],
      rt,
      nights,
      checkIn,
      status,
      needRoom: status === 'CHECKED_OUT',
      source: pick(sources),
      adults: rnd(1, 3),
    });
    count++;
  }

  // Current: checked-in today
  for (let i = 0; i < 22; i++) {
    const hotelIdx = i % hotelDefs.length;
    const pool = roomsByHotel[hotels[hotelIdx].hotel.id];
    const rt = pick([...new Set(pool.map((r) => r.rt))]);
    const nights = rnd(1, 4);
    const checkIn = addDays(now, -rnd(0, Math.max(1, nights - 1)));
    await createReservation({
      hotelIdx,
      guest: guests[(i + 30) % guests.length],
      rt,
      nights,
      checkIn: checkIn < addDays(now, -1) ? addDays(now, -1) : checkIn,
      status: 'CHECKED_IN',
      needRoom: true,
      source: pick(sources),
      adults: rnd(1, 3),
    });
  }

  // Future: confirmed / inquiry / some cancelled
  for (let i = 0; i < 45; i++) {
    const hotelIdx = i % hotelDefs.length;
    const pool = roomsByHotel[hotels[hotelIdx].hotel.id];
    const rt = pick([...new Set(pool.map((r) => r.rt))]);
    const nights = rnd(1, 4);
    const checkIn = addDays(now, rnd(1, 55));
    const roll = Math.random();
    const status = roll < 0.75 ? 'CONFIRMED' : roll < 0.88 ? 'INQUIRY' : 'CANCELLED';
    await createReservation({
      hotelIdx,
      guest: guests[(i + 60) % guests.length],
      rt,
      nights,
      checkIn,
      status,
      needRoom: status === 'CONFIRMED',
      source: pick(sources),
      adults: rnd(1, 3),
    });
  }

  // Set hotel sequence counters so new records continue correctly
  await prisma.sequence.createMany({
    data: [
      { id: `reservation-${YEAR}`, value: resSeq },
      { id: `invoice-${YEAR}`, value: folioSeq },
      { id: `staff-${YEAR}`, value: 10 },
      { id: `task-${YEAR}`, value: 1 },
      { id: `mt-${YEAR}`, value: 1 },
    ],
  });

  // Update room statuses for current occupancy
  const active = await prisma.reservation.findMany({ where: { status: 'CHECKED_IN', roomId: { not: null } }, select: { roomId: true } });
  for (const r of active) {
    if (r.roomId) {
      await prisma.room.update({ where: { id: r.roomId }, data: { status: 'OCCUPIED', housekeepingStatus: 'CLEAN' } });
    }
  }

  // ---- HOUSEKEEPING TASKS ----
  const hkStatuses = [{ s: 'ASSIGNED', done: false }, { s: 'IN_PROGRESS', done: false }, { s: 'COMPLETED', done: true }, { s: 'INSPECTED', done: true }];
  let taskSeq = 1;
  const hkUsers = [userByEmail['housekeeping@hotelops.app'].id, userByEmail['hkstaff@hotelops.app'].id];
  const roomsAll = Object.values(roomsByHotel).flat();
  for (let i = 0; i < 40; i++) {
    const roomDef = pick(roomsAll);
    const st = pick(hkStatuses);
    const hk = await prisma.housekeepingTask.create({
      data: {
        organizationId: org.id,
        hotelId: roomDef.room.hotelId,
        roomId: roomDef.room.id,
        assignedTo: hkUsers[i % 2],
        createdBy: userByEmail['housekeeping@hotelops.app'].id,
        priority: pick(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH']),
        status: st.s,
        notes: i % 4 === 0 ? 'Guest checkout - full clean' : st.done ? null : 'Routine turnover clean',
        startedAt: st.done ? addDays(now, -1) : st.s === 'IN_PROGRESS' ? addDays(now, -1) : null,
        completedAt: st.done ? addDays(now, 0) : null,
        inspectedAt: st.s === 'INSPECTED' ? addDays(now, 0) : null,
        createdAt: addDays(now, -rnd(1, 3)),
      },
    });
    if (st.done && st.s === 'INSPECTED') {
      await prisma.room.update({ where: { id: roomDef.room.id }, data: { housekeepingStatus: 'CLEAN', status: 'AVAILABLE' } });
    }
    taskSeq++;
  }

  // ---- MAINTENANCE REQUESTS ----
  const mtStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const mtCats = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'INTERNET', 'APPLIANCE', 'OTHER'];
  const mtUsers = [userByEmail['maintenance@hotelops.app'].id, userByEmail['maintstaff@hotelops.app'].id];
  for (let i = 0; i < 26; i++) {
    const roomDef = Math.random() < 0.8 ? pick(roomsAll) : null;
    const st = mtStatuses[i % mtStatuses.length];
    const cat = pick(mtCats);
    const titleMap = {
      PLUMBING: 'Leaking faucet in bathroom',
      ELECTRICAL: 'Faulty light switch',
      HVAC: 'AC not cooling properly',
      FURNITURE: 'Broken drawer in wardrobe',
      INTERNET: 'Wi-Fi dead zone in room',
      APPLIANCE: 'TV not turning on',
      OTHER: 'General maintenance request',
    };
    const m = await prisma.maintenanceRequest.create({
      data: {
        requestNumber: `MT-${YEAR}-${String(rnd(1, 400)).padStart(4, '0')}`,
        organizationId: org.id,
        hotelId: roomDef ? roomDef.room.hotelId : hotels[0].hotel.id,
        roomId: roomDef ? roomDef.room.id : null,
        category: cat,
        title: titleMap[cat] || titleMap.OTHER,
        description: 'Reported by front desk during morning inspection.',
        priority: pick(['LOW', 'MEDIUM', 'HIGH']),
        status: st,
        assignedTo: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(st) ? mtUsers[i % 2] : null,
        createdBy: userByEmail['maintenance@hotelops.app'].id,
        resolvedBy: ['RESOLVED', 'CLOSED'].includes(st) ? mtUsers[i % 2] : null,
        cost: ['RESOLVED', 'CLOSED'].includes(st) ? rnd(30, 400) : null,
        startedAt: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(st) ? addDays(now, -1) : null,
        resolvedAt: ['RESOLVED', 'CLOSED'].includes(st) ? addDays(now, 0) : null,
        createdAt: addDays(now, -rnd(1, 20)),
      },
    });
  }

  // ---- NOTIFICATIONS (for demo) ----
  await prisma.notification.createMany({
    data: [
      { organizationId: org.id, userId: userByEmail['owner@hotelops.app'].id, type: 'RESERVATION', title: '5 new bookings today', body: 'Your hotels received 5 new reservations.', channel: 'IN_APP' },
      { organizationId: org.id, userId: userByEmail['owner@hotelops.app'].id, type: 'SYSTEM', title: 'Weekly report ready', body: 'Your weekly performance report is available.', channel: 'IN_APP' },
      { organizationId: org.id, userId: userByEmail['frontdesk@hotelops.app'].id, type: 'HOUSEKEEPING', title: 'Room 1001 ready for inspection', body: 'Housekeeping completed room 1001.', channel: 'IN_APP' },
      { organizationId: org.id, userId: userByEmail['frontdesk@hotelops.app'].id, type: 'PAYMENT', title: 'Payment received', body: 'A payment of $210.00 was recorded.', channel: 'IN_APP' },
      { organizationId: org.id, userId: userByEmail['housekeeping@hotelops.app'].id, type: 'GUEST', title: 'VIP guest arriving', body: 'VIP guest checks in tomorrow.', channel: 'IN_APP' },
    ],
  });

  const totals = {
    organizations: 1,
    hotels: hotels.length,
    rooms: Object.values(roomsByHotel).reduce((a, r) => a + r.length, 0),
    users: users.length,
    guests: guests.length,
    reservations: createdReservations.length,
    checkedIn: await prisma.reservation.count({ where: { status: 'CHECKED_IN' } }),
  };

  console.log('Seed complete:', totals);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await sleep(100);
  });