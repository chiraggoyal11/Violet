export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  GuestCheckout: undefined;
};

export type ShopStackParamList = {
  ShopHome: undefined;
  ProductDetail: { id: string };
  PublicShop: { username: string };
};

export type CartStackParamList = {
  CartHome: undefined;
  Checkout: undefined;
};

export type OrdersStackParamList = {
  OrdersList: undefined;
};

export type MessagesStackParamList = {
  Inbox: undefined;
  Thread: { conversationId: string; title?: string };
};

export type SellStackParamList = {
  SellHome: undefined;
  MyListings: undefined;
};

export type AccountStackParamList = {
  AccountHome: undefined;
  EditProfile: undefined;
  Favorites: undefined;
  Wishlist: undefined;
  Notifications: undefined;
  Settings: undefined;
  SellerDashboard: undefined;
  Offers: undefined;
  Admin: undefined;
  Inbox: undefined;
  Thread: { conversationId: string; title?: string };
};

export type MainTabParamList = {
  ShopTab: undefined;
  SellTab: undefined;
  CartTab: undefined;
  OrdersTab: undefined;
  AccountTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
