export const NIVELES = [
  ['Duplo', 0],
  ['Stud', 20],
  ['Plate', 50],
  ['Three-Seven-Five', 100],
  ['Citizen', 200],
  ['Skeleton', 300],
  ['Pirate', 400],
  ['Captain', 500],
  ['Redbeard', 750],
  ['Forestman', 1000],
  ['Wolfpack', 1500],
  ['Wolfpack Master', 2000],
  ['Ninja', 2500],
  ['RX', 3000],
  ['Dragon Form', 5000],
  ['Space Baby', 6000],
  ['Space Man', 7000],
  ['Blacktron', 8000],
  ['Technic', 9000],
  ['Majisto', 10000],
  ['Castle Knight', 12500],
  ['Chrome Gold', 15000],
  ['Wooden Duck', 20000],
  ['De Billund', 30000],
  ['Mr. Kirk', 50000],
  ['Mr. Gold', 100000],
].map(([nombre, umbral], id) => ({ id, nombre, umbral }));

export const OBJETIVOS = [
  { id: 'block-by-block', nombre: 'Block by block', descripcion: 'Has añadido una minipersona', bricks: 1, repetible: true },
  { id: 'first-contact', nombre: 'First contact', descripcion: 'Has enviado la primera solicitud de amistad', bricks: 2, repetible: false },
  { id: 'handshake', nombre: 'Handshake', descripcion: 'Has aceptado la primera solicitud de amistad', bricks: 3, repetible: false },
  { id: 'crew', nombre: 'Crew', descripcion: 'Tienes 10 amigos', bricks: 20, repetible: false },
  { id: 'brick-alliance', nombre: 'Brick Alliance', descripcion: 'Tienes 20 amigos', bricks: 40, repetible: false },
  { id: 'full-house', nombre: 'Full House', descripcion: 'Tienes 50 amigos', bricks: 100, repetible: false },
  { id: 'community', nombre: 'Community', descripcion: 'Tienes un centenar de amigos', bricks: 300, repetible: false },
  { id: 'solid-investment', nombre: 'Solid Investment', descripcion: 'El valor de tu colección ha alcanzado 500€', bricks: 250, repetible: false },
  { id: 'vault-guardian', nombre: 'Vault Guardian', descripcion: 'El valor de tu colección ha alcanzado 1000€', bricks: 500, repetible: false },
  { id: 'crown-jewel', nombre: 'Crown Jewel', descripcion: 'El valor de tu colección ha alcanzado 2000€', bricks: 1000, repetible: false },
  { id: 'treasure-hoard', nombre: 'Treasure Hoard', descripcion: 'El valor de tu colección ha alcanzado 5000€', bricks: 2500, repetible: false },
  { id: 'plastic-tycoon', nombre: 'Plastic Tycoon', descripcion: 'El valor de tu colección ha alcanzado 10000€', bricks: 7000, repetible: false },
  { id: 'sweet-find', nombre: 'Sweet find', descripcion: 'Has añadido una minipersona valorada en más de 10€', bricks: 5, repetible: true },
  { id: 'hidden-gem', nombre: 'Hidden gem', descripcion: 'Has añadido una minipersona valorada en más de 50€', bricks: 25, repetible: true },
  { id: 'epic-piece', nombre: 'Epic piece', descripcion: 'Has añadido una minipersona valorada en más de 100€', bricks: 100, repetible: true },
  { id: 'holy-grail', nombre: 'Holy Grail', descripcion: 'Has añadido una minipersona valorada en más de 500€', bricks: 700, repetible: true },
  { id: 'unicorn', nombre: 'Unicorn', descripcion: 'Has añadido una minipersona valorada en más de 1000€', bricks: 2000, repetible: true },
  { id: 'fresh-start', nombre: 'Fresh start', descripcion: 'Has empezado una serie coleccionable posterior a 2016', bricks: 5, repetible: true },
  { id: 'almost-there', nombre: 'Almost there', descripcion: 'Has llegado al 80% de una serie coleccionable posterior a 2016', bricks: 20, repetible: true },
  { id: 'series-showcase', nombre: 'Series showcase', descripcion: 'Has completado una serie coleccionable posterior a 2016', bricks: 50, repetible: true },
  { id: 'retro-find', nombre: 'Retro find', descripcion: 'Has empezado una serie coleccionable anterior o igual a 2016', bricks: 15, repetible: true },
  { id: 'vault-specialist', nombre: 'Vault specialist', descripcion: 'Has llegado al 80% de una serie coleccionable anterior o igual a 2016', bricks: 50, repetible: true },
  { id: 'archived-forever', nombre: 'Archived forever', descripcion: 'Has completado una serie coleccionable anterior o igual a 2016', bricks: 100, repetible: true },
  { id: 'curator', nombre: 'Curator', descripcion: 'Has alcanzado un 50% de rasgo Collector', bricks: 50, repetible: false },
  { id: 'grail-seeker', nombre: 'Grail Seeker', descripcion: 'Has alcanzado un 50% de rasgo Rarity Hunter', bricks: 500, repetible: false },
  { id: 'nerd', nombre: 'Nerd', descripcion: 'Has alcanzado un 50% de rasgo Fan', bricks: 250, repetible: false },
  { id: 'curiosity-driven', nombre: 'Curiosity Driven', descripcion: 'Has alcanzado un 50% de rasgo Explorer', bricks: 100, repetible: false },
  { id: 'the-90s', nombre: "The 90's", descripcion: 'Has añadido una minipersona de los años 90', bricks: 20, repetible: true },
  { id: 'the-80s', nombre: "The 80's", descripcion: 'Has añadido una minipersona de los años 80', bricks: 40, repetible: true },
  { id: 'dusty-relic', nombre: 'Dusty Relic', descripcion: 'Has añadido una minipersona anterior al año 1980', bricks: 60, repetible: true },
  { id: 'oh-you-shouldnt-have', nombre: "Oh! you shouldn't have!", descripcion: 'Has recibido tu primer regalo', bricks: 20, repetible: false },
  { id: 'is-it-my-birthday-or-what', nombre: 'Is it my birthday or what?!', descripcion: 'Has recibido 10 regalos', bricks: 100, repetible: false },
  { id: 'gratitude-is-the-sign-of-noble-souls', nombre: 'Gratitude is the sign of noble souls', descripcion: 'Has dado las gracias por primera vez', bricks: 5, repetible: false },
  { id: 'great-manners', nombre: 'Great manners', descripcion: 'Has dado las gracias 10 veces', bricks: 30, repetible: false },
  { id: 'the-cornerstone', nombre: 'The cornerstone', descripcion: 'Has añadido la primera minipersona de una categoría', bricks: 5, repetible: true },
  { id: 'category-halfway', nombre: 'Category halfway', descripcion: 'Has alcanzado el 50% de una categoría de más de 50 minipersonas', bricks: 200, repetible: true },
  { id: 'theme-specialist', nombre: 'Theme specialist', descripcion: 'Has alcanzado el 80% de una categoría de más de 50 minipersonas', bricks: 500, repetible: true },
  { id: 'category-conquest', nombre: 'Category Conquest', descripcion: 'Has completado una categoría de más de 50 minipersonas', bricks: 1000, repetible: true },
  { id: 'major-milestone', nombre: 'Major milestone', descripcion: 'Has alcanzado el 50% de una categoría de más de 100 minipersonas', bricks: 500, repetible: true },
  { id: 'category-dominance', nombre: 'Category dominance', descripcion: 'Has alcanzado el 80% de una categoría de más de 100 minipersonas', bricks: 1500, repetible: true },
  { id: 'theme-master', nombre: 'Theme master', descripcion: 'Has completado una categoría de más de 100 minipersonas', bricks: 3000, repetible: true },
  { id: 'grand-horizon', nombre: 'Grand Horizon', descripcion: 'Has alcanzado el 50% de una categoría de más de 500 minipersonas', bricks: 1500, repetible: true },
  { id: 'mega-specialist', nombre: 'Mega specialist', descripcion: 'Has alcanzado el 80% de una categoría de más de 500 minipersonas', bricks: 3000, repetible: true },
  { id: 'grand-category-legend', nombre: 'Grand Category Legend', descripcion: 'Has completado una categoría de más de 500 minipersonas', bricks: 5000, repetible: true },
  { id: 'retired-police', nombre: 'Retired police', descripcion: 'Has añadido al policía de 1978', bricks: 15, repetible: false },
  { id: 'retired-firefighter', nombre: 'Retired firefighter', descripcion: 'Has añadido al bombero de 1978', bricks: 15, repetible: false },
  { id: 'retired-courier', nombre: 'Retired courier', descripcion: 'Has añadido al ¿cartero? de 1978', bricks: 15, repetible: false },
  { id: 'the-original-crew', nombre: 'The original crew', descripcion: 'Has añadido las 3 minipersonas más antiguas', bricks: 50, repetible: false },
  { id: 'pure-gold-zero-leprechauns-required', nombre: 'Pure gold, zero leprechauns required', descripcion: 'Has añadido a Mr Gold a tu colección', bricks: 1500, repetible: false },
  { id: 'pop-culture-fan', nombre: 'Pop culture fan', descripcion: 'Has añadido a tu colección un tesoro de la Comic-Con', bricks: 3000, repetible: true },
  { id: 'fairgoer', nombre: 'Fairgoer', descripcion: 'Has añadido a tu colección un tesoro de la Toy Fair', bricks: 3000, repetible: true },
  { id: 'i-have-a-soft-spot-for-him', nombre: 'I have a soft spot for him', descripcion: 'Has añadido a Sprinter a tu colección', bricks: 10, repetible: false },
  { id: 'dear-olivusik', nombre: 'Dear Olivusik', descripcion: 'Has añadido una Olivia a tu colección', bricks: 5, repetible: true },
  { id: 'strike-it-rich', nombre: 'Strike it rich!', descripcion: 'Has añadido a C-3PO Chrome Gold a tu colección', bricks: 1500, repetible: false },
  { id: 'we-all-make-mistakes', nombre: 'We all make mistakes', descripcion: 'Has añadido al auténtico Finch Dallow a tu colección', bricks: 500, repetible: false },
  { id: 'sewer-treasure', nombre: 'Sewer Treasure', descripcion: 'Has añadido a Shadow Leonardo a tu colección', bricks: 400, repetible: false },
  { id: 'your-adventure-begins', nombre: 'Your adventure begins', descripcion: 'Has añadido la primera minipersona de la categoría Adventurers', bricks: 30, repetible: false },
  { id: 'new-sea-creature', nombre: 'New sea creature', descripcion: 'Has añadido la primera minipersona de la categoría Atlantis', bricks: 30, repetible: false },
  { id: 'old-bat', nombre: 'Old bat', descripcion: 'Has añadido la primera minipersona de la categoría Batman I', bricks: 50, repetible: false },
  { id: 'there-is-a-new-boy-in-the-castle', nombre: 'There is a new boy in the castle', descripcion: 'Has añadido la primera minipersona de la categoría Castle', bricks: 30, repetible: false },
  { id: 'dimensional', nombre: 'Dimensional', descripcion: 'Has añadido la primera minipersona de la categoría Dimensions', bricks: 40, repetible: false },
  { id: 'bricky-mouse', nombre: 'Bricky Mouse', descripcion: 'Has añadido la primera minipersona de la categoría Disney', bricks: 20, repetible: false },
  { id: 'daydreamer', nombre: 'Daydreamer', descripcion: 'Has añadido la primera minipersona de la categoría DREAMZzz', bricks: 15, repetible: false },
  { id: 'you-dropped-in-tilted-towers', nombre: 'You dropped in Tilted Towers', descripcion: 'Has añadido la primera minipersona de la categoría Fortnite', bricks: 20, repetible: false },
  { id: 'alohomora', nombre: 'Alohomora!', descripcion: 'Has añadido la primera minipersona de la categoría Harry Potter', bricks: 15, repetible: false },
  { id: 'may-the-sun-shine-upon-you', nombre: 'May the Sun shine upon you', descripcion: 'Has añadido la primera minipersona de la categoría Horizon', bricks: 20, repetible: false },
  { id: 'that-belongs-in-a-museum', nombre: 'That belongs in a museum!', descripcion: 'Has añadido la primera minipersona de la categoría Indiana Jones', bricks: 30, repetible: false },
  { id: 'clever-girl', nombre: 'Clever girl...', descripcion: 'Has añadido la primera minipersona de la categoría Jurassic World', bricks: 15, repetible: false },
  { id: 'a-new-warrior-joins-the-tribe', nombre: 'A new warrior joins the Tribe!', descripcion: 'Has añadido la primera minipersona de la categoría LEGENDS OF CHIMA', bricks: 30, repetible: false },
  { id: 'sssss-boom', nombre: 'Sssss... BOOM!', descripcion: 'Has añadido la primera minipersona de la categoría Minecraft', bricks: 15, repetible: false },
  { id: 'unlocking-the-monkie-power', nombre: 'Unlocking the Monkie Power!', descripcion: 'Has añadido la primera minipersona de la categoría Monkie Kid', bricks: 30, repetible: false },
  { id: 'upgrade-complete-new-knight-in-the-realm', nombre: 'Upgrade Complete: New Knight in the Realm!', descripcion: 'Has añadido la primera minipersona de la categoría NEXO KNIGHTS', bricks: 30, repetible: false },
  { id: 'iron-sharpens-iron-brother-sharpens-brother', nombre: 'Iron sharpens iron, brother sharpens brother', descripcion: 'Has añadido la primera minipersona de la categoría NINJAGO', bricks: 15, repetible: false },
  { id: 'im-going-to-be-the-king-of-the-pirates', nombre: "I'm going to be the King of the Pirates!", descripcion: 'Has añadido la primera minipersona de la categoría One Piece', bricks: 20, repetible: false },
  { id: 'land-ho', nombre: 'Land ho!', descripcion: 'Has añadido la primera minipersona de la categoría Pirates', bricks: 30, repetible: false },
  { id: 'you-almost-caught-captain-jack-sparrow', nombre: 'You almost caught Captain Jack Sparrow!', descripcion: 'Has añadido la primera minipersona de la categoría Pirates of the Caribbean', bricks: 20, repetible: false },
  { id: 'i-choose-you', nombre: 'I choose you!', descripcion: 'Has añadido la primera minipersona de la categoría Pokémon', bricks: 20, repetible: false },
  { id: 'gotta-go-fast', nombre: 'Gotta go fast!', descripcion: 'Has añadido la primera minipersona de la categoría Sonic the Hedgehog', bricks: 20, repetible: false },
  { id: 'houston-weve-had-a-problem-here', nombre: "Houston, we've had a problem here", descripcion: 'Has añadido la primera minipersona de la categoría Space', bricks: 15, repetible: false },
  { id: 'web-slinger', nombre: 'Web-slinger', descripcion: 'Has añadido la primera minipersona de la categoría Spider-Man', bricks: 15, repetible: false },
  { id: 'are-you-ready-kids', nombre: 'Are you ready, kids?', descripcion: 'Has añadido la primera minipersona de la categoría SpongeBob SquarePants', bricks: 20, repetible: false },
  { id: 'warsie', nombre: 'Warsie', descripcion: 'Has añadido la primera minipersona de la categoría Star Wars', bricks: 15, repetible: false },
  { id: 'trekkie', nombre: 'Trekkie', descripcion: 'Has añadido la primera minipersona de la categoría Star Trek', bricks: 30, repetible: false },
  { id: 'welcome-to-the-upsidedown', nombre: 'Welcome to the Upsidedown', descripcion: 'Has añadido la primera minipersona de la categoría Stranger Things', bricks: 40, repetible: false },
  { id: 'i-can-do-this-all-day', nombre: 'I can do this all day', descripcion: 'Has añadido la primera minipersona de la categoría Super Heroes', bricks: 10, repetible: false },
  { id: 'its-a-me-mario', nombre: "It's-a me, Mario!", descripcion: 'Has añadido la primera minipersona de la categoría Super Mario', bricks: 20, repetible: false },
  { id: 'cowabunga', nombre: 'Cowabunga!', descripcion: 'Has añadido la primera minipersona de la categoría Teenage Mutant Ninja Turtles', bricks: 40, repetible: false },
  { id: 'my-precious', nombre: 'My precious...', descripcion: 'Has añadido la primera minipersona de la categoría The Hobbit & The Lord of the Rings', bricks: 20, repetible: false },
  { id: 'its-dangerous-to-go-alone-take-this', nombre: "It's dangerous to go alone! Take this.", descripcion: 'Has añadido la primera minipersona de la categoría The Legend of Zelda', bricks: 30, repetible: false },
  { id: 'honey-where-are-my-paaannts', nombre: 'Honey, where are my paaannts?', descripcion: 'Has añadido la primera minipersona de la categoría The LEGO Movie', bricks: 30, repetible: false },
  { id: 'welcome-to-apocalypseburg', nombre: 'Welcome to Apocalypseburg', descripcion: 'Has añadido la primera minipersona de la categoría The LEGO Movie 2', bricks: 30, repetible: false },
  { id: 'the-worst-guy-in-the-world', nombre: 'The worst guy in the world', descripcion: 'Has añadido la primera minipersona de la categoría The LEGO NINJAGO Movie', bricks: 30, repetible: false },
  { id: 'ay-caramba', nombre: '¡Ay, caramba!', descripcion: 'Has añadido la primera minipersona de la categoría The Simpsons', bricks: 30, repetible: false },
  { id: 'theres-a-snake-in-my-boot', nombre: "There's a snake in my boot!", descripcion: 'Has añadido la primera minipersona de la categoría Toy Story', bricks: 20, repetible: false },
  { id: 'a-new-cowboy-in-the-wild-west', nombre: 'A new cowboy in the Wild West', descripcion: 'Has añadido la primera minipersona de la categoría Western', bricks: 30, repetible: false },
  { id: 'youngling', nombre: 'Youngling', descripcion: 'Has añadido 5 minipersonas del universo Star Wars', bricks: 5, repetible: false },
  { id: 'padawan', nombre: 'Padawan', descripcion: 'Has añadido 10 minipersonas del universo Star Wars', bricks: 20, repetible: false },
  { id: 'jedi-knight', nombre: 'Jedi Knight', descripcion: 'Has añadido 20 minipersonas del universo Star Wars', bricks: 50, repetible: false },
  { id: 'jedi-master', nombre: 'Jedi Master', descripcion: 'Has añadido 50 minipersonas del universo Star Wars', bricks: 200, repetible: false },
  { id: 'grand-master', nombre: 'Grand Master', descripcion: 'Has añadido 100 minipersonas del universo Star Wars', bricks: 1000, repetible: false },
  { id: 'muggle', nombre: 'Muggle', descripcion: 'Has añadido 5 minipersonas del universo Harry Potter', bricks: 5, repetible: false },
  { id: 'first-year', nombre: 'First-Year', descripcion: 'Has añadido 10 minipersonas del universo Harry Potter', bricks: 20, repetible: false },
  { id: 'prefect', nombre: 'Prefect', descripcion: 'Has añadido 20 minipersonas del universo Harry Potter', bricks: 50, repetible: false },
  { id: 'head-student', nombre: 'Head Student', descripcion: 'Has añadido 50 minipersonas del universo Harry Potter', bricks: 200, repetible: false },
  { id: 'order-of-merlin', nombre: 'Order of Merlin', descripcion: 'Has añadido 100 minipersonas del universo Harry Potter', bricks: 1000, repetible: false },
  { id: 'sidekick', nombre: 'Sidekick', descripcion: 'Has añadido 5 Super Heroes', bricks: 5, repetible: false },
  { id: 'hero', nombre: 'Hero', descripcion: 'Has añadido 10 Super Heroes', bricks: 20, repetible: false },
  { id: 'superhero', nombre: 'Superhero', descripcion: 'Has añadido 20 Super Heroes', bricks: 50, repetible: false },
  { id: 'legend', nombre: 'Legend', descripcion: 'Has añadido 50 Super Heroes', bricks: 200, repetible: false },
  { id: 'universe-guardian', nombre: 'Universe Guardian', descripcion: 'Has añadido 100 Super Heroes', bricks: 1000, repetible: false },
  { id: 'mouseketeer', nombre: 'Mouseketeer', descripcion: 'Has añadido 5 minipersonas del universo Disney', bricks: 5, repetible: false },
  { id: 'dream-chaser', nombre: 'Dream Chaser', descripcion: 'Has añadido 10 minipersonas del universo Disney', bricks: 20, repetible: false },
  { id: 'fairytale-fan', nombre: 'Fairytale Fan', descripcion: 'Has añadido 20 minipersonas del universo Disney', bricks: 50, repetible: false },
  { id: 'magic-master', nombre: 'Magic Master', descripcion: 'Has añadido 50 minipersonas del universo Disney', bricks: 200, repetible: false },
  { id: 'once-upon-a-legend', nombre: 'Once Upon a Legend', descripcion: 'Has añadido 100 minipersonas del universo Disney', bricks: 1000, repetible: false },
];

export const LOGRO_REGALO = {
  id: 'someone-liked-your-collection',
  type: 'regalo',
  nombre: 'Your collection is top!',
  descripcion: 'Has aparecido en el ranking global y te han hecho un regalo.',
  bricks: 50,
  repetible: true,
};

export const LOGRO_REGALO_SEMANAL = {
  id: 'youre-on-fire-this-week',
  type: 'regalo',
  nombre: "You're on fire this week!",
  descripcion: 'Has aparecido en el ranking semanal y te han hecho un regalo.',
  bricks: 5,
  repetible: true,
};

export const LOGRO_AGRADECIMIENTO = {
  id: 'thanks-for-the-gift',
  type: 'regalo',
  nombre: 'Gratitude is the sign of noble souls',
  descripcion: 'Un coleccionista te dio las gracias por tu regalo.',
  bricks: 5,
  repetible: true,
};

const namedWeights = (collector, rarityHunter, fan, explorer) => ({ collector, rarityHunter, fan, explorer });
const weightGroups = [
  { ids: ['block-by-block', 'first-contact', 'handshake', 'crew', 'brick-alliance', 'full-house', 'community'], weights: namedWeights(0, 0, 0, 0) },
  { ids: ['solid-investment', 'sweet-find'], weights: namedWeights(80, 5, 10, 5) },
  { ids: ['vault-guardian'], weights: namedWeights(70, 15, 10, 5) },
  { ids: ['crown-jewel'], weights: namedWeights(60, 20, 10, 10) },
  { ids: ['treasure-hoard', 'plastic-tycoon'], weights: namedWeights(50, 50, 0, 0) },
  { ids: ['hidden-gem'], weights: namedWeights(50, 20, 20, 10) },
  { ids: ['epic-piece'], weights: namedWeights(30, 40, 25, 5) },
  { ids: ['holy-grail'], weights: namedWeights(10, 80, 10, 0) },
  { ids: ['unicorn'], weights: namedWeights(0, 100, 0, 0) },
  { ids: ['fresh-start'], weights: namedWeights(30, 0, 10, 60) },
  { ids: ['almost-there', 'series-showcase', 'retro-find', 'vault-specialist', 'archived-forever'], weights: namedWeights(90, 0, 10, 0) },
  { ids: ['curator', 'grail-seeker', 'nerd', 'curiosity-driven'], weights: namedWeights(0, 0, 0, 0) },
  { ids: ['the-90s', 'the-80s', 'dusty-relic'], weights: namedWeights(30, 65, 0, 5) },
  { ids: ['oh-you-shouldnt-have', 'is-it-my-birthday-or-what', 'gratitude-is-the-sign-of-noble-souls', 'great-manners'], weights: namedWeights(0, 0, 0, 0) },
  { ids: ['the-cornerstone'], weights: namedWeights(10, 0, 0, 90) },
  { ids: ['category-halfway', 'theme-specialist', 'category-conquest', 'major-milestone', 'category-dominance', 'theme-master', 'grand-horizon', 'mega-specialist', 'grand-category-legend'], weights: namedWeights(60, 0, 40, 0) },
  { ids: ['retired-police', 'retired-firefighter', 'retired-courier'], weights: namedWeights(20, 80, 0, 0) },
  { ids: ['the-original-crew'], weights: namedWeights(50, 50, 0, 0) },
  { ids: ['pure-gold-zero-leprechauns-required', 'pop-culture-fan', 'fairgoer', 'strike-it-rich', 'we-all-make-mistakes', 'sewer-treasure'], weights: namedWeights(0, 100, 0, 0) },
  { ids: ['i-have-a-soft-spot-for-him', 'dear-olivusik'], weights: namedWeights(25, 25, 25, 25) },
  { ids: ['your-adventure-begins', 'new-sea-creature', 'old-bat', 'there-is-a-new-boy-in-the-castle', 'dimensional', 'bricky-mouse', 'daydreamer', 'you-dropped-in-tilted-towers', 'alohomora', 'may-the-sun-shine-upon-you', 'that-belongs-in-a-museum', 'clever-girl', 'a-new-warrior-joins-the-tribe', 'sssss-boom', 'unlocking-the-monkie-power', 'upgrade-complete-new-knight-in-the-realm', 'iron-sharpens-iron-brother-sharpens-brother', 'im-going-to-be-the-king-of-the-pirates', 'land-ho', 'you-almost-caught-captain-jack-sparrow', 'i-choose-you', 'gotta-go-fast', 'houston-weve-had-a-problem-here', 'web-slinger', 'are-you-ready-kids', 'warsie', 'trekkie', 'welcome-to-the-upsidedown', 'i-can-do-this-all-day', 'its-a-me-mario', 'cowabunga', 'my-precious', 'its-dangerous-to-go-alone-take-this', 'honey-where-are-my-paaannts', 'welcome-to-apocalypseburg', 'the-worst-guy-in-the-world', 'ay-caramba', 'theres-a-snake-in-my-boot', 'a-new-cowboy-in-the-wild-west'], weights: namedWeights(10, 0, 0, 90) },
  { ids: ['youngling', 'padawan', 'jedi-knight', 'jedi-master', 'grand-master', 'muggle', 'first-year', 'prefect', 'head-student', 'order-of-merlin', 'sidekick', 'hero', 'superhero', 'legend', 'universe-guardian', 'mouseketeer', 'dream-chaser', 'fairytale-fan', 'magic-master', 'once-upon-a-legend'], weights: namedWeights(5, 0, 95, 0) },
];

export const DNA_PONDERACIONES = new Map(weightGroups.flatMap(({ ids, weights }) => ids.map((id) => [id, { ...weights }])));

if (DNA_PONDERACIONES.size !== OBJETIVOS.length || OBJETIVOS.some(({ id }) => !DNA_PONDERACIONES.has(id))) {
  throw new Error('El catálogo y las ponderaciones DNA deben incluir los mismos objetivos.');
}

for (const [id, weights] of DNA_PONDERACIONES) {
  const values = Object.values(weights);
  const sum = values.reduce((total, weight) => total + weight, 0);
  if (values.some((weight) => !Number.isInteger(weight) || weight < 0 || weight > 100) || ![0, 100].includes(sum)) {
    throw new Error(`Ponderación DNA inválida para ${id}.`);
  }
}

export function proyectarPesosDnaSql() {
  return [...DNA_PONDERACIONES].map(([logroId, weights]) => ({
    logro_id: logroId,
    rarity_hunter: weights.rarityHunter,
    collector: weights.collector,
    explorer: weights.explorer,
    fan: weights.fan,
  }));
}

const DNA_THRESHOLD_TRAITS = new Map([
  ['curator', 'collector'],
  ['grail-seeker', 'rarityHunter'],
  ['nerd', 'fan'],
  ['curiosity-driven', 'explorer'],
]);

export function calcularPorcentajesDna(logros) {
  const scores = { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 };
  for (const logro of logros) {
    if (DNA_THRESHOLD_TRAITS.has(logro.id)) continue;
    const weights = DNA_PONDERACIONES.get(logro.id);
    const cantidad = Number(logro.cantidad);
    if (!weights || !Number.isFinite(cantidad) || cantidad <= 0) continue;
    scores.rarityHunter += cantidad * weights.rarityHunter;
    scores.collector += cantidad * weights.collector;
    scores.explorer += cantidad * weights.explorer;
    scores.fan += cantidad * weights.fan;
  }
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  return Object.fromEntries(Object.entries(scores).map(([trait, score]) => [trait, total === 0 ? 0 : (score / total) * 100]));
}

export function evaluarHitosDna(porcentajes) {
  return new Map([...DNA_THRESHOLD_TRAITS].map(([id, trait]) => [id, Number(porcentajes[trait] >= 50)]));
}

function valueOf(minifigura) {
  if (Number.isFinite(minifigura.precio) && minifigura.precio >= 0) return minifigura.precio;
  return Number.isFinite(minifigura.precioCompra) && minifigura.precioCompra >= 0 ? minifigura.precioCompra : 0;
}

function countBy(catalogo, predicate) {
  return catalogo.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function categoryTotal(categorias, categoria, subcategoria) {
  const category = categorias.find((item) => item.categoria === categoria);
  if (!category) return 0;
  if (subcategoria !== undefined) {
    return category.subcategorias.find((item) => item.subcategoria === subcategoria)?.total || 0;
  }
  return category.total || 0;
}

const TOTAL_VALUE_MILESTONES = new Map([
  ['solid-investment', 500],
  ['vault-guardian', 1000],
  ['crown-jewel', 2000],
  ['treasure-hoard', 5000],
  ['plastic-tycoon', 10000],
]);

const FIGURE_PRICE_MILESTONES = new Map([
  ['sweet-find', 10],
  ['hidden-gem', 50],
  ['epic-piece', 100],
  ['holy-grail', 500],
  ['unicorn', 1000],
]);

const DECADE_MILESTONES = new Map([
  ['the-90s', (year) => year >= 1990 && year <= 1999],
  ['the-80s', (year) => year >= 1980 && year <= 1989],
  ['dusty-relic', (year) => year > 0 && year < 1980],
]);

const SERIES_MILESTONES = new Map([
  ['fresh-start', { era: 'modern', condition: 'started' }],
  ['almost-there', { era: 'modern', condition: 'over-80-percent' }],
  ['series-showcase', { era: 'modern', condition: 'complete' }],
  ['retro-find', { era: 'retro', condition: 'started' }],
  ['vault-specialist', { era: 'retro', condition: 'over-80-percent' }],
  ['archived-forever', { era: 'retro', condition: 'complete' }],
]);

const CATEGORY_PROGRESS_MILESTONES = new Map([
  ['category-halfway', { bracket: 'small', percentage: 50 }],
  ['theme-specialist', { bracket: 'small', percentage: 80 }],
  ['category-conquest', { bracket: 'small', percentage: 100 }],
  ['major-milestone', { bracket: 'medium', percentage: 50 }],
  ['category-dominance', { bracket: 'medium', percentage: 80 }],
  ['theme-master', { bracket: 'medium', percentage: 100 }],
  ['grand-horizon', { bracket: 'large', percentage: 50 }],
  ['mega-specialist', { bracket: 'large', percentage: 80 }],
  ['grand-category-legend', { bracket: 'large', percentage: 100 }],
]);

const CATEGORY_FIRST_ACHIEVEMENTS = new Map([
  ['your-adventure-begins', 'Adventurers'],
  ['new-sea-creature', 'Atlantis'],
  ['old-bat', 'Batman I'],
  ['there-is-a-new-boy-in-the-castle', 'Castle'],
  ['dimensional', 'Dimensions'],
  ['bricky-mouse', 'Disney'],
  ['daydreamer', 'DREAMZzz'],
  ['you-dropped-in-tilted-towers', 'Fortnite'],
  ['alohomora', 'Harry Potter'],
  ['may-the-sun-shine-upon-you', 'Horizon'],
  ['that-belongs-in-a-museum', 'Indiana Jones'],
  ['clever-girl', 'Jurassic World'],
  ['a-new-warrior-joins-the-tribe', 'LEGENDS OF CHIMA'],
  ['sssss-boom', 'Minecraft'],
  ['unlocking-the-monkie-power', 'Monkie Kid'],
  ['upgrade-complete-new-knight-in-the-realm', 'NEXO KNIGHTS'],
  ['iron-sharpens-iron-brother-sharpens-brother', 'NINJAGO'],
  ['im-going-to-be-the-king-of-the-pirates', 'One Piece'],
  ['land-ho', 'Pirates'],
  ['you-almost-caught-captain-jack-sparrow', 'Pirates of the Caribbean'],
  ['i-choose-you', 'Pokémon'],
  ['gotta-go-fast', 'Sonic the Hedgehog'],
  ['houston-weve-had-a-problem-here', 'Space'],
  ['web-slinger', 'Spider-Man'],
  ['are-you-ready-kids', 'SpongeBob SquarePants'],
  ['warsie', 'Star Wars'],
  ['trekkie', 'Star Trek'],
  ['welcome-to-the-upsidedown', 'Stranger Things'],
  ['i-can-do-this-all-day', 'Super Heroes'],
  ['its-a-me-mario', 'Super Mario'],
  ['cowabunga', 'Teenage Mutant Ninja Turtles'],
  ['my-precious', 'The Hobbit & The Lord of the Rings'],
  ['its-dangerous-to-go-alone-take-this', 'The Legend of Zelda'],
  ['honey-where-are-my-paaannts', 'The LEGO Movie'],
  ['welcome-to-apocalypseburg', 'The LEGO Movie 2'],
  ['the-worst-guy-in-the-world', 'The LEGO NINJAGO Movie'],
  ['ay-caramba', 'The Simpsons'],
  ['theres-a-snake-in-my-boot', 'Toy Story'],
  ['a-new-cowboy-in-the-wild-west', 'Western'],
]);

const FRANCHISES = [
  { name: 'Star Wars', categories: ['Star Wars'], subcategoryIncludes: null, objectives: [['youngling', 5], ['padawan', 10], ['jedi-knight', 20], ['jedi-master', 50], ['grand-master', 100]] },
  { name: 'Harry Potter', categories: ['Harry Potter'], subcategoryIncludes: 'harry potter', objectives: [['muggle', 5], ['first-year', 10], ['prefect', 20], ['head-student', 50], ['order-of-merlin', 100]] },
  { name: 'Super Heroes', categories: ['Super Heroes', 'Spider-Man'], subcategoryIncludes: 'super heroes', objectives: [['sidekick', 5], ['hero', 10], ['superhero', 20], ['legend', 50], ['universe-guardian', 100]] },
  { name: 'Disney', categories: ['Disney'], subcategoryIncludes: 'disney', objectives: [['mouseketeer', 5], ['dream-chaser', 10], ['fairytale-fan', 20], ['magic-master', 50], ['once-upon-a-legend', 100]] },
];

const FRANCHISE_OBJECTIVES = new Map(FRANCHISES.flatMap((franchise) => franchise.objectives.map(([id, threshold]) => [
  id,
  { ...franchise, threshold },
])));

const SPECIAL_FIGURE_IDS = new Map([
  ['retired-police', ['COP014S']],
  ['retired-firefighter', ['FIREC019']],
  ['retired-courier', ['PLN018']],
  ['pure-gold-zero-leprechauns-required', ['COL161']],
  ['i-have-a-soft-spot-for-him', ['COL427']],
  ['strike-it-rich', ['SW0158']],
  ['we-all-make-mistakes', ['SW1005']],
  ['sewer-treasure', ['TNT001']],
  ['the-original-crew', ['COP014S', 'FIREC019', 'PLN018']],
]);

const SPECIAL_FULL_NAME_MATCHES = new Map([
  ['pop-culture-fan', 'comic-con'],
  ['fairgoer', 'toy fair'],
  ['dear-olivusik', 'olivia'],
]);

const SOCIAL_THRESHOLD_ACHIEVEMENTS = new Map([
  ['crew', { source: 'friends', threshold: 10 }],
  ['brick-alliance', { source: 'friends', threshold: 20 }],
  ['full-house', { source: 'friends', threshold: 50 }],
  ['community', { source: 'friends', threshold: 100 }],
  ['oh-you-shouldnt-have', { source: 'gifts', threshold: 1 }],
  ['is-it-my-birthday-or-what', { source: 'gifts', threshold: 10 }],
  ['gratitude-is-the-sign-of-noble-souls', { source: 'thanks_sent', threshold: 1 }],
  ['great-manners', { source: 'thanks_sent', threshold: 10 }],
]);

const GIFT_ACHIEVEMENT_IDS = new Set([
  'oh-you-shouldnt-have', 'is-it-my-birthday-or-what',
  'gratitude-is-the-sign-of-noble-souls', 'great-manners',
]);

function categoryProgressBracket(total) {
  if (total > 500) return 'large';
  if (total > 100) return 'medium';
  if (total > 50) return 'small';
  return null;
}

function countCategoryProgress(objectiveId, catalogo, categorias) {
  const rule = CATEGORY_PROGRESS_MILESTONES.get(objectiveId);
  if (!rule) return 0;

  let count = 0;
  for (const category of categorias) {
    const total = category.total;
    if (!Number.isInteger(total) || total <= 0 || categoryProgressBracket(total) !== rule.bracket) continue;
    const owned = catalogo.filter((figure) => normalizeAchievementKey(figure.categoria) === normalizeAchievementKey(category.categoria)).length;
    if (owned * 100 >= total * rule.percentage) count += 1;
  }
  return count;
}

function franchiseFigureCount(franchise, catalogo) {
  return new Set(catalogo.filter((figure) => {
    const categoryMatches = franchise.categories.some((category) => normalizeAchievementKey(category) === normalizeAchievementKey(figure.categoria));
    const subcategory = normalizeAchievementKey(figure.subcategoria);
    return categoryMatches || (franchise.subcategoryIncludes && subcategory.includes(franchise.subcategoryIncludes));
  }).map(({ id }) => normalizeAchievementKey(id)).filter(Boolean)).size;
}

function fullNameOf(figure) {
  return normalizeAchievementKey(figure.nombreCompleto ?? [figure.nombre, figure.descripcion].filter(Boolean).join(' '));
}

function specialAchievementCount(objectiveId, catalogo) {
  if (objectiveId === 'the-original-crew') {
    const requiredIds = new Set(SPECIAL_FIGURE_IDS.get(objectiveId));
    const ownedIds = new Set(catalogo.map(({ id }) => normalizeAchievementKey(id).toUpperCase()));
    return [...requiredIds].every((id) => ownedIds.has(id)) ? 1 : 0;
  }

  if (SPECIAL_FIGURE_IDS.has(objectiveId)) {
    const requiredIds = new Set(SPECIAL_FIGURE_IDS.get(objectiveId));
    return catalogo.filter(({ id }) => requiredIds.has(normalizeAchievementKey(id).toUpperCase())).length;
  }

  const nameFragment = SPECIAL_FULL_NAME_MATCHES.get(objectiveId);
  return nameFragment ? countBy(catalogo, (figure) => fullNameOf(figure).includes(nameFragment)) : 0;
}

function countSeriesMilestones(objectiveId, catalogo, categorias) {
  const rule = SERIES_MILESTONES.get(objectiveId);
  const category = categorias.find(({ categoria }) => normalizeAchievementKey(categoria) === 'collectible minifigures');
  if (!rule || !category) return 0;

  let count = 0;
  for (const subcategory of category.subcategorias) {
    const year = subcategory.anioInicio;
    const total = subcategory.total;
    if (!Number.isInteger(year) || year <= 0) continue;
    if (rule.era === 'modern' ? year < 2017 : year > 2016) continue;
    const figures = catalogo.filter((figure) => normalizeAchievementKey(figure.categoria) === 'collectible minifigures'
      && normalizeAchievementKey(figure.subcategoria) === normalizeAchievementKey(subcategory.subcategoria));
    if (rule.condition === 'started' && figures.length > 0) count += 1;
    if (rule.condition === 'started') continue;
    if (!Number.isInteger(total) || total <= 0) continue;
    if (rule.condition === 'over-80-percent' && figures.length * 100 > total * 80) count += 1;
    if (rule.condition === 'complete' && figures.length >= total) count += 1;
  }
  return count;
}

function normalizeAchievementKey(value) {
  return typeof value === 'string' ? value.trim().normalize('NFKC').toLocaleLowerCase() : '';
}

function uniqueCollection(catalogo) {
  const figuresById = new Map();
  for (const figure of catalogo) {
    if (figure.estadoColeccion !== 'COLECCIÓN') continue;
    const canonicalId = normalizeAchievementKey(figure.id);
    if (canonicalId && !figuresById.has(canonicalId)) figuresById.set(canonicalId, figure);
  }
  return [...figuresById.values()];
}

function distinctCategoryCount(catalogo) {
  return new Set(catalogo.map(({ categoria }) => normalizeAchievementKey(categoria)).filter(Boolean)).size;
}

function achievementCount(objective, catalogo, categorias, socialSources = {}, regalosRecibidos = 0, regalosSemanalesRecibidos = 0) {
  let count = 0;
  if (objective.id === 'block-by-block') count = catalogo.length;
  if (objective.id === 'the-cornerstone') count = distinctCategoryCount(catalogo);
  if (FIGURE_PRICE_MILESTONES.has(objective.id)) {
    const threshold = FIGURE_PRICE_MILESTONES.get(objective.id);
    count = countBy(catalogo, (figure) => valueOf(figure) > threshold);
  }
  if (TOTAL_VALUE_MILESTONES.has(objective.id)) {
    const threshold = TOTAL_VALUE_MILESTONES.get(objective.id);
    count = catalogo.reduce((total, figure) => total + valueOf(figure), 0) >= threshold ? 1 : 0;
  }
  if (DECADE_MILESTONES.has(objective.id)) {
    const inDecade = DECADE_MILESTONES.get(objective.id);
    count = countBy(catalogo, ({ anio }) => Number.isInteger(anio) && inDecade(anio));
  }
  if (SERIES_MILESTONES.has(objective.id)) count = countSeriesMilestones(objective.id, catalogo, categorias);
  if (CATEGORY_PROGRESS_MILESTONES.has(objective.id)) count = countCategoryProgress(objective.id, catalogo, categorias);
  if (CATEGORY_FIRST_ACHIEVEMENTS.has(objective.id)) {
    const categoryName = normalizeAchievementKey(CATEGORY_FIRST_ACHIEVEMENTS.get(objective.id));
    count = catalogo.some(({ categoria }) => normalizeAchievementKey(categoria) === categoryName) ? 1 : 0;
  }
  if (FRANCHISE_OBJECTIVES.has(objective.id)) {
    const franchise = FRANCHISE_OBJECTIVES.get(objective.id);
    count = franchiseFigureCount(franchise, catalogo) >= franchise.threshold ? 1 : 0;
  }
  if (SPECIAL_FIGURE_IDS.has(objective.id) || SPECIAL_FULL_NAME_MATCHES.has(objective.id)) {
    count = specialAchievementCount(objective.id, catalogo);
  }
  if (objective.id === 'first-contact') {
    count = Number(socialSources.sent_pending > 0 || socialSources.accepted_sent > 0);
  }
  if (objective.id === 'handshake') count = Number(socialSources.accepted_received > 0);
  if (SOCIAL_THRESHOLD_ACHIEVEMENTS.has(objective.id)) {
    const { source, threshold } = SOCIAL_THRESHOLD_ACHIEVEMENTS.get(objective.id);
    const sourceCount = source === 'gifts'
      ? regalosRecibidos + regalosSemanalesRecibidos
      : socialSources[source] ?? 0;
    count = Number(sourceCount >= threshold);
  }
  return objective.repetible ? count : Math.min(count, 1);
}

export function selectLevel(bricks) {
  let currentIndex = 0;
  for (let index = 0; index < NIVELES.length; index += 1) {
    if (NIVELES[index].umbral <= bricks) currentIndex = index;
  }

  const nivel = NIVELES[currentIndex];
  const siguienteNivel = NIVELES[currentIndex + 1] || null;
  const intervalo = siguienteNivel ? siguienteNivel.umbral - nivel.umbral : 0;
  const porcentaje = siguienteNivel
    ? Math.round(Math.min(100, Math.max(0, ((bricks - nivel.umbral) / intervalo) * 100)))
    : 100;

  return {
    nivel,
    siguienteNivel,
    progreso: {
      actual: bricks,
      desde: nivel.umbral,
      hasta: siguienteNivel?.umbral ?? nivel.umbral,
      porcentaje,
    },
  };
}

export function calcularGamificacion(catalogo, categorias = [], regalosRecibidos = 0, agradecimientosRecibidos = 0, regalosSemanalesRecibidos = 0, socialSources = {}) {
  const globalGiftCount = Number.isInteger(regalosRecibidos) && regalosRecibidos > 0 ? regalosRecibidos : 0;
  const weeklyGiftCount = Number.isInteger(regalosSemanalesRecibidos) && regalosSemanalesRecibidos > 0 ? regalosSemanalesRecibidos : 0;
  const receivedThanksCount = Number.isInteger(agradecimientosRecibidos) && agradecimientosRecibidos > 0 ? agradecimientosRecibidos : 0;
  const catalogoColeccion = uniqueCollection(catalogo);
  const baseAchievementCounts = new Map(OBJETIVOS
    .filter(({ id }) => !DNA_THRESHOLD_TRAITS.has(id))
    .map((objective) => [objective.id, achievementCount(objective, catalogoColeccion, categorias, socialSources, globalGiftCount, weeklyGiftCount)]));
  const dnaPercentages = calcularPorcentajesDna([...baseAchievementCounts].map(([id, cantidad]) => ({ id, cantidad })));
  const dnaMilestoneCounts = evaluarHitosDna(dnaPercentages);
  const logros = OBJETIVOS.map((objective) => {
    const cantidad = DNA_THRESHOLD_TRAITS.has(objective.id)
      ? dnaMilestoneCounts.get(objective.id)
      : baseAchievementCounts.get(objective.id);
    return {
      id: objective.id,
      ...(GIFT_ACHIEVEMENT_IDS.has(objective.id) ? { type: 'regalo' } : {}),
      nombre: objective.nombre,
      descripcion: objective.descripcion,
      bricks: objective.bricks,
      repetible: objective.repetible,
      cantidad,
      total: cantidad * objective.bricks,
    };
  }).filter((logro) => logro.cantidad > 0);
  const bricks = logros.reduce((total, logro) => total + logro.total, 0)
    + globalGiftCount * 50 + weeklyGiftCount * 5 + receivedThanksCount * 5;
  return { bricks, ...selectLevel(bricks), logros };
}

export function nivelesAlcanzados(previous, next) {
  if (!previous || next.nivel.id <= previous.nivel.id) return [];
  return NIVELES.slice(previous.nivel.id + 1, next.nivel.id + 1);
}

export function nuevosLogros(previous, next) {
  const previousById = new Map((previous?.logros || []).map((logro) => [logro.id, logro]));
  return next.logros
    .filter((logro) => logro.cantidad > (previousById.get(logro.id)?.cantidad || 0))
    .map((logro) => ({ ...logro, cantidadNueva: logro.cantidad - (previousById.get(logro.id)?.cantidad || 0), bricksNuevos: (logro.cantidad - (previousById.get(logro.id)?.cantidad || 0)) * logro.bricks }));
}
