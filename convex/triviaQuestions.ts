export type TriviaQuestion = Readonly<{
  id: string;
  category: string;
  prompt: string;
  options: readonly [string, string, string, string];
  answer: string;
  correctOptionIndex: 0 | 1 | 2 | 3;
}>;

export const TRIVIA_CATEGORIES = [
  'Science',
  'History',
  'Geography',
  'Arts & Literature',
  'Technology',
  'Nature',
  'Games & Culture',
] as const;

export type TriviaCategory = (typeof TRIVIA_CATEGORIES)[number];

export const TRIVIA_ROUND_OPTIONS = [5, 10, 15, 20] as const;
export const TRIVIA_DEFAULT_ROUND_COUNT = 10;

export function isTriviaCategory(value: string): value is TriviaCategory {
  return (TRIVIA_CATEGORIES as readonly string[]).includes(value);
}

export function isTriviaRoundCount(value: number): value is (typeof TRIVIA_ROUND_OPTIONS)[number] {
  return (TRIVIA_ROUND_OPTIONS as readonly number[]).includes(value);
}

function question(
  id: string,
  category: string,
  prompt: string,
  options: readonly [string, string, string, string],
  correctOptionIndex: 0 | 1 | 2 | 3
): TriviaQuestion {
  return { id, category, prompt, options, answer: options[correctOptionIndex], correctOptionIndex };
}

/**
 * The first-party launch bank. Played rounds snapshot these values into the
 * database, so a future user-generated or generated source can use the same
 * game lifecycle without exposing mutable source content mid-match.
 */
export const TRIVIA_QUESTIONS: readonly TriviaQuestion[] = [
  question(
    'science-001',
    'Science',
    'Which element has the atomic number 74?',
    ['Tantalum', 'Tungsten', 'Rhenium', 'Osmium'],
    1
  ),
  question(
    'science-002',
    'Science',
    'What is the SI derived unit of catalytic activity?',
    ['Katal', 'Becquerel', 'Siemens', 'Weber'],
    0
  ),
  question(
    'science-003',
    'Science',
    'Which gauge boson carries the strong nuclear force?',
    ['Photon', 'W boson', 'Gluon', 'Graviton'],
    2
  ),
  question(
    'science-004',
    'Science',
    'Which planet has an axial tilt of roughly 98 degrees?',
    ['Saturn', 'Neptune', 'Mars', 'Uranus'],
    3
  ),
  question(
    'science-005',
    'Science',
    'Which noble gas is most abundant in Earth’s atmosphere?',
    ['Argon', 'Neon', 'Helium', 'Krypton'],
    0
  ),
  question(
    'science-006',
    'Science',
    'Cobalt is a central component of which vitamin?',
    ['Vitamin B6', 'Vitamin B12', 'Vitamin D', 'Vitamin K'],
    1
  ),
  question(
    'science-007',
    'Science',
    'Which mineral defines hardness 9 on the Mohs scale?',
    ['Topaz', 'Quartz', 'Corundum', 'Diamond'],
    2
  ),
  question(
    'science-008',
    'Science',
    'Which organelle modifies, sorts, and packages proteins for secretion?',
    ['Lysosome', 'Nucleolus', 'Peroxisome', 'Golgi apparatus'],
    3
  ),
  question(
    'science-009',
    'Science',
    'Which principle places a fundamental limit on simultaneously knowing a particle’s position and momentum?',
    ['Pauli exclusion principle', 'Heisenberg uncertainty principle', 'Huygens principle', 'Le Chatelier’s principle'],
    1
  ),
  question(
    'science-010',
    'Science',
    'The Chandrasekhar limit describes the maximum stable mass of what object?',
    ['A white dwarf', 'A neutron star', 'A brown dwarf', 'A red giant'],
    0
  ),
  question(
    'science-011',
    'Science',
    'Nylon 6 is primarily produced from which monomer?',
    ['Styrene', 'Ethylene glycol', 'Caprolactam', 'Vinyl chloride'],
    2
  ),
  question(
    'science-012',
    'Science',
    'A solution at pH 2 has how many times the hydrogen ion concentration of a solution at pH 4?',
    ['2 times', '10 times', '50 times', '100 times'],
    3
  ),
  question(
    'science-013',
    'Science',
    'Which vessel carries blood directly from the liver toward the heart?',
    ['Hepatic vein', 'Portal vein', 'Renal artery', 'Superior mesenteric vein'],
    0
  ),
  question(
    'science-014',
    'Science',
    'Which moon is the largest natural satellite in the Solar System?',
    ['Titan', 'Ganymede', 'Callisto', 'Triton'],
    1
  ),
  question(
    'science-015',
    'Science',
    'Which enzyme unwinds the DNA double helix during replication?',
    ['Ligase', 'Polymerase', 'Helicase', 'Primase'],
    2
  ),
  question(
    'science-016',
    'Science',
    'Which mineral is the most common crystalline form of calcium carbonate?',
    ['Gypsum', 'Fluorite', 'Dolomite', 'Calcite'],
    3
  ),
  question(
    'science-017',
    'Science',
    'Most atmospheric ozone is concentrated in which layer?',
    ['Stratosphere', 'Troposphere', 'Mesosphere', 'Thermosphere'],
    0
  ),
  question(
    'science-018',
    'Science',
    'Which isotope is conventionally used to date once-living material up to tens of thousands of years old?',
    ['Uranium-238', 'Carbon-14', 'Potassium-40', 'Rubidium-87'],
    1
  ),
  question(
    'science-019',
    'Science',
    'The optical phenomenon of double refraction is especially associated with which crystal?',
    ['Halite', 'Quartz', 'Calcite', 'Galena'],
    2
  ),
  question(
    'science-020',
    'Science',
    'What is the name of the boundary beyond which light cannot escape a black hole?',
    ['Photon sphere', 'Accretion horizon', 'Roche limit', 'Event horizon'],
    3
  ),

  question(
    'history-001',
    'History',
    'Which settlement is conventionally said to have ended the Thirty Years’ War in 1648?',
    ['Peace of Westphalia', 'Treaty of Utrecht', 'Peace of Augsburg', 'Treaty of Tordesillas'],
    0
  ),
  question(
    'history-002',
    'History',
    'Which Roman emperor co-issued the Edict of Milan in 313 CE?',
    ['Diocletian', 'Constantine I', 'Theodosius I', 'Julian'],
    1
  ),
  question(
    'history-003',
    'History',
    'The 1618 Defenestration of Prague helped trigger which conflict?',
    ['War of the Spanish Succession', 'Seven Years’ War', 'Thirty Years’ War', 'Great Northern War'],
    2
  ),
  question(
    'history-004',
    'History',
    'The Rosetta Stone was rediscovered during the military campaign of which leader?',
    ['Horatio Nelson', 'Arthur Wellesley', 'Jean-Baptiste Colbert', 'Napoleon Bonaparte'],
    3
  ),
  question(
    'history-005',
    'History',
    'In which year did the Meiji Restoration formally begin?',
    ['1868', '1853', '1877', '1889'],
    0
  ),
  question(
    'history-006',
    'History',
    'Which leader became the best-known general of the Haitian Revolution before dying in French custody?',
    ['Jean-Jacques Dessalines', 'Toussaint Louverture', 'Henri Christophe', 'Alexandre Pétion'],
    1
  ),
  question(
    'history-007',
    'History',
    'The Battle of Hastings took place in which year?',
    ['1016', '1042', '1066', '1087'],
    2
  ),
  question(
    'history-008',
    'History',
    'King John sealed Magna Carta at which location?',
    ['Bosworth Field', 'Canterbury', 'Westminster', 'Runnymede'],
    3
  ),
  question(
    'history-009',
    'History',
    'Which Chinese dynasty first issued widely circulating government-backed paper money?',
    ['Song', 'Han', 'Tang', 'Ming'],
    0
  ),
  question(
    'history-010',
    'History',
    'Which Austrian statesman was the dominant diplomatic figure at the Congress of Vienna?',
    ['Otto von Bismarck', 'Klemens von Metternich', 'Charles Maurice de Talleyrand', 'Franz Joseph I'],
    1
  ),
  question(
    'history-011',
    'History',
    'Which Inca ruler was captured by Francisco Pizarro at Cajamarca?',
    ['Huayna Capac', 'Manco Inca', 'Atahualpa', 'Túpac Amaru II'],
    2
  ),
  question(
    'history-012',
    'History',
    'Which Ottoman sultan captured Constantinople in 1453?',
    ['Bayezid I', 'Selim I', 'Suleiman I', 'Mehmed II'],
    3
  ),
  question(
    'history-013',
    'History',
    'The ancient Library of Ashurbanipal was uncovered at the ruins of which city?',
    ['Nineveh', 'Ur', 'Persepolis', 'Hattusa'],
    0
  ),
  question(
    'history-014',
    'History',
    'The 1494 Treaty of Tordesillas divided newly encountered lands between Spain and which kingdom?',
    ['France', 'Portugal', 'England', 'Aragon'],
    1
  ),
  question(
    'history-015',
    'History',
    'Which empire used quipu as a system for recording information?',
    ['Aztec Empire', 'Mali Empire', 'Inca Empire', 'Khmer Empire'],
    2
  ),

  question(
    'geography-001',
    'Geography',
    'Which country is completely surrounded by South Africa?',
    ['Eswatini', 'Botswana', 'Namibia', 'Lesotho'],
    3
  ),
  question(
    'geography-002',
    'Geography',
    'Which country has the world’s longest coastline?',
    ['Canada', 'Indonesia', 'Russia', 'Norway'],
    0
  ),
  question(
    'geography-003',
    'Geography',
    'Which river flows through Vienna, Bratislava, Budapest, and Belgrade?',
    ['Rhine', 'Danube', 'Dnieper', 'Vistula'],
    1
  ),
  question(
    'geography-004',
    'Geography',
    'Salar de Uyuni, the world’s largest salt flat, is in which country?',
    ['Chile', 'Argentina', 'Bolivia', 'Peru'],
    2
  ),
  question(
    'geography-005',
    'Geography',
    'Which lake is the deepest in the world?',
    ['Lake Tanganyika', 'Caspian Sea', 'Lake Vostok', 'Lake Baikal'],
    3
  ),
  question(
    'geography-006',
    'Geography',
    'Mount Elbrus belongs to which mountain range?',
    ['Caucasus', 'Carpathians', 'Urals', 'Alps'],
    0
  ),
  question(
    'geography-007',
    'Geography',
    'The Bosporus connects the Black Sea with which body of water?',
    ['Aegean Sea', 'Sea of Marmara', 'Adriatic Sea', 'Sea of Azov'],
    1
  ),
  question(
    'geography-008',
    'Geography',
    'Angel Falls is located in which country?',
    ['Guyana', 'Colombia', 'Venezuela', 'Suriname'],
    2
  ),
  question(
    'geography-009',
    'Geography',
    'Lake Titicaca lies on the border of Peru and which country?',
    ['Ecuador', 'Chile', 'Brazil', 'Bolivia'],
    3
  ),
  question(
    'geography-010',
    'Geography',
    'Which river runs through Baghdad?',
    ['Tigris', 'Euphrates', 'Jordan', 'Orontes'],
    0
  ),
  question(
    'geography-011',
    'Geography',
    'The largest portion of the Atacama Desert lies in which country?',
    ['Peru', 'Chile', 'Bolivia', 'Argentina'],
    1
  ),
  question(
    'geography-012',
    'Geography',
    'The Gobi Desert spans Mongolia and which other country?',
    ['Kazakhstan', 'Russia', 'China', 'Kyrgyzstan'],
    2
  ),
  question(
    'geography-013',
    'Geography',
    'The Mekong River forms its vast delta primarily in which country?',
    ['Cambodia', 'Thailand', 'Laos', 'Vietnam'],
    3
  ),
  question(
    'geography-014',
    'Geography',
    'Which sea is defined by ocean currents rather than land boundaries?',
    ['Sargasso Sea', 'Coral Sea', 'Arabian Sea', 'Bering Sea'],
    0
  ),
  question(
    'geography-015',
    'Geography',
    'Lake Tana is the primary source of which major river branch?',
    ['White Nile', 'Blue Nile', 'Orange River', 'Zambezi'],
    1
  ),

  question(
    'arts-001',
    'Arts & Literature',
    'Who wrote “The Master and Margarita”?',
    ['Boris Pasternak', 'Aleksandr Solzhenitsyn', 'Mikhail Bulgakov', 'Nikolai Gogol'],
    2
  ),
  question(
    'arts-002',
    'Arts & Literature',
    'Who painted “Las Meninas”?',
    ['Francisco Goya', 'El Greco', 'Bartolomé Murillo', 'Diego Velázquez'],
    3
  ),
  question(
    'arts-003',
    'Arts & Literature',
    'Which epic poem opens by invoking the wrath of Achilles?',
    ['The Iliad', 'The Odyssey', 'The Aeneid', 'The Theogony'],
    0
  ),
  question(
    'arts-004',
    'Arts & Literature',
    'Who composed “The Rite of Spring”?',
    ['Sergei Prokofiev', 'Igor Stravinsky', 'Dmitri Shostakovich', 'Nikolai Rimsky-Korsakov'],
    1
  ),
  question(
    'arts-005',
    'Arts & Literature',
    'What is the first name of the narrator in Daphne du Maurier’s “Rebecca”?',
    ['Caroline', 'Eleanor', 'It is never revealed', 'Diana'],
    2
  ),
  question(
    'arts-006',
    'Arts & Literature',
    'Who designed Fallingwater?',
    ['Ludwig Mies van der Rohe', 'Le Corbusier', 'Walter Gropius', 'Frank Lloyd Wright'],
    3
  ),
  question(
    'arts-007',
    'Arts & Literature',
    '“The Treachery of Images,” featuring a painted pipe, is by which artist?',
    ['René Magritte', 'Max Ernst', 'Joan Miró', 'Salvador Dalí'],
    0
  ),
  question(
    'arts-008',
    'Arts & Literature',
    'Prospero is the central magician in which Shakespeare play?',
    ['Cymbeline', 'The Tempest', 'The Winter’s Tale', 'Pericles'],
    1
  ),
  question(
    'arts-009',
    'Arts & Literature',
    'Sethe is the protagonist of which Toni Morrison novel?',
    ['Song of Solomon', 'Sula', 'Beloved', 'Jazz'],
    2
  ),
  question(
    'arts-010',
    'Arts & Literature',
    'Who sculpted “The Ecstasy of Saint Teresa”?',
    ['Donatello', 'Michelangelo', 'Antonio Canova', 'Gian Lorenzo Bernini'],
    3
  ),
  question(
    'arts-011',
    'Arts & Literature',
    'Who wrote “If on a winter’s night a traveler”?',
    ['Italo Calvino', 'Umberto Eco', 'Primo Levi', 'Alberto Moravia'],
    0
  ),
  question(
    'arts-012',
    'Arts & Literature',
    'The Queen of the Night appears in which Mozart opera?',
    ['Don Giovanni', 'The Magic Flute', 'Così fan tutte', 'Idomeneo'],
    1
  ),
  question(
    'arts-013',
    'Arts & Literature',
    'Who wrote the poem “The Waste Land”?',
    ['W. H. Auden', 'Ezra Pound', 'T. S. Eliot', 'Wallace Stevens'],
    2
  ),
  question(
    'arts-014',
    'Arts & Literature',
    'The “Arnolfini Portrait” is generally attributed to which painter?',
    ['Hans Holbein the Younger', 'Albrecht Dürer', 'Hieronymus Bosch', 'Jan van Eyck'],
    3
  ),
  question(
    'arts-015',
    'Arts & Literature',
    'In Greek mythology, which Muse presides over history?',
    ['Clio', 'Calliope', 'Erato', 'Urania'],
    0
  ),

  question(
    'tech-001',
    'Technology',
    'Which language is generally regarded as the first widely used high-level programming language?',
    ['COBOL', 'FORTRAN', 'ALGOL', 'Lisp'],
    1
  ),
  question(
    'tech-002',
    'Technology',
    'Who created the C programming language at Bell Labs?',
    ['Ken Thompson', 'Brian Kernighan', 'Dennis Ritchie', 'Bjarne Stroustrup'],
    2
  ),
  question(
    'tech-003',
    'Technology',
    'Which TCP port is the conventional default for HTTPS?',
    ['80', '22', '8080', '443'],
    3
  ),
  question(
    'tech-004',
    'Technology',
    'In the ACID database properties, what does the “I” stand for?',
    ['Isolation', 'Integrity', 'Idempotence', 'Inheritance'],
    0
  ),
  question(
    'tech-005',
    'Technology',
    'The security of textbook RSA is primarily associated with the difficulty of what problem?',
    [
      'Discrete logarithms on elliptic curves',
      'Factoring large integers',
      'Finding hash collisions',
      'Solving shortest vectors',
    ],
    1
  ),
  question(
    'tech-006',
    'Technology',
    'From inside to outside, which comes immediately after padding in the CSS box model?',
    ['Margin', 'Content', 'Border', 'Outline'],
    2
  ),
  question(
    'tech-007',
    'Technology',
    'Which DNS record type maps a hostname to an IPv6 address?',
    ['A', 'CNAME', 'PTR', 'AAAA'],
    3
  ),
  question('tech-008', 'Technology', 'Which HTTP status code means “No Content”?', ['204', '202', '304', '206'], 0),
  question(
    'tech-009',
    'Technology',
    'The Unix epoch begins at midnight UTC on which date?',
    ['January 1, 1960', 'January 1, 1970', 'January 1, 1980', 'January 1, 2000'],
    1
  ),
  question(
    'tech-010',
    'Technology',
    'In UTF-8, a continuation byte always begins with which bit pattern?',
    ['0', '110', '10', '1110'],
    2
  ),
  question(
    'tech-011',
    'Technology',
    'Third normal form is designed in part to eliminate which kind of dependency?',
    ['Multivalued dependency', 'Join dependency', 'Partial key dependency', 'Transitive dependency on a key'],
    3
  ),
  question(
    'tech-012',
    'Technology',
    'Which algorithm finds shortest paths from one source in a graph with nonnegative edge weights?',
    ['Dijkstra’s algorithm', 'Kruskal’s algorithm', 'KMP algorithm', 'Floyd’s cycle detection'],
    0
  ),
  question(
    'tech-013',
    'Technology',
    'In the CAP theorem, what does the “P” represent?',
    ['Persistence', 'Partition tolerance', 'Parallelism', 'Predictability'],
    1
  ),
  question(
    'tech-014',
    'Technology',
    'What is the smallest deployable compute object in Kubernetes?',
    ['Container', 'ReplicaSet', 'Pod', 'Node'],
    2
  ),
  question(
    'tech-015',
    'Technology',
    'Which SQL clause filters groups after aggregation?',
    ['WHERE', 'ORDER BY', 'QUALIFY', 'HAVING'],
    3
  ),
  question(
    'tech-016',
    'Technology',
    'What is the time complexity of binary search on a sorted array?',
    ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'],
    0
  ),
  question(
    'tech-017',
    'Technology',
    'Baseline JPEG compression transforms image blocks using which operation?',
    ['Fast Fourier transform', 'Discrete cosine transform', 'Wavelet transform', 'Radon transform'],
    1
  ),
  question(
    'tech-018',
    'Technology',
    'Which protocol introduced a way for two parties to establish a shared secret over a public channel?',
    ['Kerberos', 'OAuth', 'Diffie–Hellman key exchange', 'SAML'],
    2
  ),
  question(
    'tech-019',
    'Technology',
    'Which data structure is commonly used for indexes optimized for block storage?',
    ['Bloom filter', 'Skip list', 'Trie', 'B-tree'],
    3
  ),
  question(
    'tech-020',
    'Technology',
    'Which Git object directly records a project snapshot plus parent commit references?',
    ['Commit', 'Tree', 'Blob', 'Tag'],
    0
  ),

  question(
    'nature-001',
    'Nature',
    'Which mammals are capable of true sustained flight?',
    ['Flying squirrels', 'Bats', 'Colugos', 'Sugar gliders'],
    1
  ),
  question(
    'nature-002',
    'Nature',
    'What is the largest living bird by mass?',
    ['Emu', 'Southern cassowary', 'Common ostrich', 'Emperor penguin'],
    2
  ),
  question(
    'nature-003',
    'Nature',
    'The blue blood of many cephalopods uses which copper-containing oxygen carrier?',
    ['Hemoglobin', 'Myoglobin', 'Chlorocruorin', 'Hemocyanin'],
    3
  ),
  question(
    'nature-004',
    'Nature',
    'The axolotl’s retention of juvenile traits into adulthood is called what?',
    ['Neoteny', 'Aestivation', 'Ecdysis', 'Apomixis'],
    0
  ),
  question(
    'nature-005',
    'Nature',
    'The coelacanth belongs to which major group of fishes?',
    ['Ray-finned fishes', 'Lobe-finned fishes', 'Cartilaginous fishes', 'Jawless fishes'],
    1
  ),
  question(
    'nature-006',
    'Nature',
    'A lichen is chiefly a symbiosis between a fungus and what photosynthetic partner?',
    ['Moss', 'Fern gametophyte', 'Alga or cyanobacterium', 'Protozoan'],
    2
  ),
  question(
    'nature-007',
    'Nature',
    'Which birds can sustain controlled backward flight?',
    ['Swifts', 'Kingfishers', 'Kestrels', 'Hummingbirds'],
    3
  ),
  question(
    'nature-008',
    'Nature',
    'What is Earth’s largest terrestrial biome by area?',
    ['Boreal forest', 'Tropical rainforest', 'Temperate grassland', 'Tundra'],
    0
  ),
  question(
    'nature-009',
    'Nature',
    'Which cetacean group uses echolocation for hunting?',
    ['Baleen whales', 'Toothed whales', 'All whales equally', 'No cetaceans'],
    1
  ),
  question(
    'nature-010',
    'Nature',
    'Which marsupial is famous for producing cube-shaped droppings?',
    ['Quokka', 'Koala', 'Wombat', 'Tasmanian devil'],
    2
  ),

  question(
    'culture-001',
    'Games & Culture',
    'What is the official marathon distance?',
    ['40 km', '26 km', '42 km', '42.195 km'],
    3
  ),
  question(
    'culture-002',
    'Games & Culture',
    'In chess, which capture can only occur immediately after an opposing pawn advances two squares?',
    ['En passant', 'Castling', 'Underpromotion', 'Zwischenzug'],
    0
  ),
  question(
    'culture-003',
    'Games & Culture',
    'What is the maximum standard break in snooker without a free ball?',
    ['155', '147', '140', '151'],
    1
  ),
  question(
    'culture-004',
    'Games & Culture',
    'In the Tour de France, the yellow jersey is worn by the leader of which classification?',
    ['Points', 'Mountains', 'General', 'Young rider'],
    2
  ),
  question(
    'culture-005',
    'Games & Culture',
    'In baseball, what is an “immaculate inning”?',
    [
      'Three outs on three pitches',
      'No balls put in play',
      'A 1-2-3 inning by one pitcher',
      'Three strikeouts on nine pitches',
    ],
    3
  ),
  question(
    'culture-006',
    'Games & Culture',
    'How many runs are awarded when a cricket batter clears the boundary without the ball bouncing?',
    ['Six', 'Four', 'Five', 'Seven'],
    0
  ),
  question(
    'culture-007',
    'Games & Culture',
    'How many points is a try worth in rugby union before the conversion?',
    ['Three', 'Five', 'Six', 'Seven'],
    1
  ),
  question(
    'culture-008',
    'Games & Culture',
    'Which fencing weapon has no right-of-way rule?',
    ['Foil', 'Sabre', 'Épée', 'All three use it'],
    2
  ),
  question(
    'culture-009',
    'Games & Culture',
    'How long is the shot clock in the NBA?',
    ['30 seconds', '20 seconds', '35 seconds', '24 seconds'],
    3
  ),
  question(
    'culture-010',
    'Games & Culture',
    'Who directed the 1954 film “Seven Samurai”?',
    ['Akira Kurosawa', 'Yasujirō Ozu', 'Kenji Mizoguchi', 'Masaki Kobayashi'],
    0
  ),
  question(
    'culture-011',
    'Games & Culture',
    'The “Rashomon effect” describes what?',
    [
      'A circular narrative',
      'Contradictory accounts of the same event',
      'A story told in reverse',
      'An unreliable dream sequence',
    ],
    1
  ),
  question(
    'culture-012',
    'Games & Culture',
    'Which electronic instrument is played without physical contact?',
    ['Ondes Martenot', 'Mellotron', 'Theremin', 'Clavinet'],
    2
  ),
  question(
    'culture-013',
    'Games & Culture',
    'Gamelan music is most closely associated with which country?',
    ['Thailand', 'Philippines', 'Malaysia', 'Indonesia'],
    3
  ),
  question(
    'culture-014',
    'Games & Culture',
    'Which European language is generally classified as a language isolate?',
    ['Basque', 'Welsh', 'Albanian', 'Maltese'],
    0
  ),
  question(
    'culture-015',
    'Games & Culture',
    'The savory taste called umami is strongly associated with which compound?',
    ['Capsaicin', 'Glutamate', 'Citric acid', 'Tannin'],
    1
  ),
  question(
    'culture-016',
    'Games & Culture',
    'What is the national epic of Finland?',
    ['The Edda', 'The Nibelungenlied', 'The Kalevala', 'The Mabinogion'],
    2
  ),
  question(
    'culture-017',
    'Games & Culture',
    'Which board game uses the terms atari, komi, and ko?',
    ['Shogi', 'Xiangqi', 'Othello', 'Go'],
    3
  ),
  question(
    'culture-018',
    'Games & Culture',
    'Which instrument is especially central to Argentine tango ensembles?',
    ['Bandoneon', 'Balalaika', 'Bouzouki', 'Concertina'],
    0
  ),
  question(
    'culture-019',
    'Games & Culture',
    'Which classical Japanese theater form is known for its restrained movement and carved masks?',
    ['Kabuki', 'Noh', 'Bunraku', 'Kyogen'],
    1
  ),
  question(
    'culture-020',
    'Games & Culture',
    'In tennis scoring, what word represents zero points?',
    ['Nil', 'Blank', 'Love', 'Duck'],
    2
  ),
];

export function selectTriviaQuestions(
  categories: readonly TriviaCategory[],
  count: number,
  random: () => number = Math.random
): TriviaQuestion[] {
  const selectedCategories = new Set(categories);
  const questions = TRIVIA_QUESTIONS.filter((question) => selectedCategories.has(question.category as TriviaCategory));
  if (questions.length < count) {
    throw new Error('The selected categories do not contain enough trivia questions.');
  }
  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }
  return questions.slice(0, count);
}
