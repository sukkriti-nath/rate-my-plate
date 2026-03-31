export interface MenuItem {
  date: string; // YYYY-MM-DD
  dayName: string;
  breakfast: string;
  starch: string | null;
  veganProtein: string | null;
  veg: string | null;
  protein1: string | null;
  protein2: string | null;
  sauceSides: string | null;
  restaurant: string | null;
  noService: boolean;
}

export interface Vote {
  id: number;
  menuDate: string;
  userName: string;
  userEmail: string;
  slackUserId: string | null;
  ratingOverall: number | null;
  ratingStarch: number | null;
  ratingVeganProtein: number | null;
  ratingVeg: number | null;
  ratingProtein1: number | null;
  ratingProtein2: number | null;
  comment: string | null;
  commentStarch: string | null;
  commentVeganProtein: string | null;
  commentVeg: string | null;
  commentProtein1: string | null;
  commentProtein2: string | null;
  createdAt: string;
}

export interface DishRating {
  avg: number;
  votes: number;
}

export interface VoteStats {
  totalVotes: number;
  averageOverall: number;
  dishRatings: {
    starch: DishRating;
    veganProtein: DishRating;
    veg: DishRating;
    protein1: DishRating;
    protein2: DishRating;
  };
  distribution: Record<number, number>;
}

export interface UserSession {
  email: string;
  displayName: string;
}
