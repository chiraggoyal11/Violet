export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ShopStackParamList = {
  ShopHome: undefined;
  ProductDetail: { id: string };
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

export type MainTabParamList = {
  ShopTab: undefined;
  CartTab: undefined;
  OrdersTab: undefined;
  MessagesTab: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
