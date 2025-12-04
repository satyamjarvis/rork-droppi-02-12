import { User } from "../types/models";

export const mockUsers: User[] = [
  {
    id: "manager-1",
    name: "צוות הנהלה",
    phone: "+972500000000",
    password: "1234",
    role: "manager",
    email: "admin@droppi.co.il",
  },
  {
    id: "business-1",
    name: "קפה נגה",
    phone: "+972500000001",
    password: "1234",
    role: "business",
    businessProfile: {
      address: "דיזנגוף 120, תל אביב",
      email: "nogacafe@droppi.co.il",
    },
  },
  {
    id: "business-2",
    name: "מאפה היובל",
    phone: "+972500000002",
    password: "1234",
    role: "business",
    businessProfile: {
      address: "היובל 18, הרצליה",
      email: "bakery@droppi.co.il",
    },
  },
  {
    id: "courier-1",
    name: "דניאל",
    phone: "+972500000101",
    password: "1234",
    role: "courier",
    courierProfile: {
      age: 29,
      email: "daniel@droppi.co.il",
      vehicle: "אופנוע",
    },
  },
  {
    id: "courier-2",
    name: "ליה",
    phone: "+972500000102",
    password: "1234",
    role: "courier",
    courierProfile: {
      age: 24,
      email: "liya@droppi.co.il",
      vehicle: "אופניים חשמליים",
    },
  },
];
